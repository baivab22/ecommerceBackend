const VisitorEvent = require("../modals/visitorEvent.modal");
const {
  BUSINESS_TZ,
  RANGES,
  BUCKET_FORMAT,
  resolveWindow,
  zeroFill,
  rollUpToFiveMinutes,
  classifySource
} = require("../utils/analyticsTime");

const MAX_PATH_LENGTH = 500;

// ────────────────────────────────────────────────────────────────────────────
// Visitor analytics
//
//   POST /api/analytics/track     — public ingest (optional auth links shoppers)
//   GET  /api/analytics/visitors  — admin-only dashboard read
//
// Buckets are produced in the store's business timezone (MongoDB `$dateToString`
// accepts IANA zone names) and labelled server-side, so the dashboard can never
// re-interpret a bucket in the viewer's local timezone.
//
// Pure date/label/source helpers live in ../utils/analyticsTime so they can be
// unit tested without a database connection.
// ────────────────────────────────────────────────────────────────────────────

const getDevice = (userAgent = "") => {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(userAgent)) return "mobile";
  if (userAgent) return "desktop";
  return "unknown";
};

const isValidId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9._:-]{8,200}$/.test(value);

const isObjectId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

// MARK: ingest

exports.trackVisitor = async (req, res) => {
  const {visitorId, sessionId, path, referrer} = req.body || {};

  if (!isValidId(visitorId) || !isValidId(sessionId) || typeof path !== "string" || !path.trim()) {
    return res.status(400).json({success: false, message: "Invalid visitor event."});
  }

  try {
    await VisitorEvent.create({
      visitorId,
      sessionId,
      path: path.trim().slice(0, MAX_PATH_LENGTH),
      referrer:
        typeof referrer === "string"
          ? referrer.trim().slice(0, MAX_PATH_LENGTH) || undefined
          : undefined,
      device: getDevice(req.get("user-agent")),
      isNewSession: req.get("x-analytics-session-new") === "1",
      // Correlation for signed-in shoppers; absent for anonymous traffic.
      userId: isObjectId(String(req.user?.userId || "")) ? req.user.userId : undefined
    });

    return res.status(202).json({success: true});
  } catch (error) {
    console.error("Visitor event tracking failed:", error);
    return res.status(500).json({success: false, message: "Unable to record visitor event."});
  }
};

// MARK: dashboard read

exports.getVisitorAnalytics = async (req, res) => {
  const range = RANGES[req.query.range] ? req.query.range : "day";
  const now = new Date();
  const {config, start, end} = resolveWindow(range, now);
  const match = {createdAt: {$gte: start, $lte: end}};
  const format = BUCKET_FORMAT[config.bucket];

  try {
    const [summary] = await VisitorEvent.aggregate([
      {$match: match},
      {
        $group: {
          _id: null,
          pageViews: {$sum: 1},
          visitors: {$addToSet: "$visitorId"},
          sessions: {$addToSet: "$sessionId"},
          signedIn: {$addToSet: "$userId"}
        }
      },
      {
        $project: {
          _id: 0,
          pageViews: 1,
          uniqueVisitors: {$size: "$visitors"},
          sessions: {$size: "$sessions"},
          signedInVisitors: {$size: {$filter: {input: "$signedIn", cond: {$ne: ["$$this", null]}}}},
          pageViewsPerVisitor: {
            $cond: [
              {$gt: [{$size: "$visitors"}, 0]},
              {$round: [{$divide: ["$pageViews", {$size: "$visitors"}]}, 2]},
              0
            ]
          }
        }
      }
    ]);

    // Bounce = the visit opened exactly one page and left. Needs a per-session
    // page count first, so it cannot be derived from the summary above.
    const [sessionStats] = await VisitorEvent.aggregate([
      {$match: match},
      {$group: {_id: "$sessionId", pageViews: {$sum: 1}}},
      {
        $group: {
          _id: null,
          totalSessions: {$sum: 1},
          singlePageSessions: {$sum: {$cond: [{$eq: ["$pageViews", 1]}, 1, 0]}}
        }
      }
    ]);

    const totalSessions = sessionStats?.totalSessions || 0;
    const singlePageSessions = sessionStats?.singlePageSessions || 0;
    const bounceRate = totalSessions
      ? Math.round((singlePageSessions / totalSessions) * 100)
      : 0;

    const [timelineRows, topPages, devices, referrerRows] = await Promise.all([
      VisitorEvent.aggregate([
        {$match: match},
        {
          $group: {
            _id: {$dateToString: {format, date: "$createdAt", timezone: BUSINESS_TZ}},
            pageViews: {$sum: 1},
            visitors: {$addToSet: "$visitorId"}
          }
        },
        {$project: {_id: 0, bucket: "$_id", pageViews: 1, uniqueVisitors: {$size: "$visitors"}}},
        {$sort: {bucket: 1}}
      ]),
      VisitorEvent.aggregate([
        {$match: match},
        {$group: {_id: "$path", pageViews: {$sum: 1}, visitors: {$addToSet: "$visitorId"}}},
        {$project: {_id: 0, path: "$_id", pageViews: 1, uniqueVisitors: {$size: "$visitors"}}},
        {$sort: {pageViews: -1}},
        {$limit: 10}
      ]),
      VisitorEvent.aggregate([
        {$match: match},
        {$group: {_id: "$device", pageViews: {$sum: 1}, visitors: {$addToSet: "$visitorId"}}},
        {$project: {_id: 0, device: "$_id", pageViews: 1, uniqueVisitors: {$size: "$visitors"}}},
        {$sort: {pageViews: -1}}
      ]),
      VisitorEvent.aggregate([
        {$match: {...match, referrer: {$exists: true, $nin: [null, ""]}}},
        {$group: {_id: "$referrer", pageViews: {$sum: 1}, visitors: {$addToSet: "$visitorId"}}},
        {$project: {_id: 0, referrer: "$_id", pageViews: 1, uniqueVisitors: {$size: "$visitors"}}},
        {$sort: {pageViews: -1}},
        {$limit: 200}
      ])
    ]);

    // Direct = visits with no referrer recorded at all.
    const [direct] = await VisitorEvent.aggregate([
      {
        $match: {
          ...match,
          $or: [{referrer: {$exists: false}}, {referrer: null}, {referrer: ""}]
        }
      },
      {$group: {_id: null, pageViews: {$sum: 1}, visitors: {$addToSet: "$visitorId"}}},
      {$project: {_id: 0, pageViews: 1, uniqueVisitors: {$size: "$visitors"}}}
    ]);

    // ── Timeline ──────────────────────────────────────────────────────────
    const timeline =
      config.bucket === "minute"
        ? rollUpToFiveMinutes(timelineRows)
        : zeroFill(timelineRows, config.bucket === "hour" ? "hour" : "day");

    // ── Traffic sources ───────────────────────────────────────────────────
    const sourceMap = new Map();
    const addSource = (source, pageViews, uniqueVisitors) => {
      const entry = sourceMap.get(source) || {source, pageViews: 0, uniqueVisitors: 0};
      entry.pageViews += pageViews;
      // Unique visitors are summed per referrer; an upper bound is acceptable here.
      entry.uniqueVisitors += uniqueVisitors;
      sourceMap.set(source, entry);
    };

    if (direct?.pageViews) addSource("Direct", direct.pageViews, direct.uniqueVisitors || 0);

    for (const row of referrerRows) {
      addSource(classifySource(row.referrer).source, row.pageViews, row.uniqueVisitors);
    }

    const sources = Array.from(sourceMap.values()).sort((a, b) => b.pageViews - a.pageViews);

    return res.json({
      success: true,
      range,
      timezone: BUSINESS_TZ,
      from: start.toISOString(),
      to: end.toISOString(),
      summary: {
        ...(summary || {
          pageViews: 0,
          uniqueVisitors: 0,
          sessions: 0,
          signedInVisitors: 0,
          pageViewsPerVisitor: 0
        }),
        totalSessions,
        singlePageSessions,
        bounceRate
      },
      timeline,
      topPages,
      devices,
      sources,
      // Raw referrers power the dashboard's "Top referrers" panel; `sources` is
      // the same data rolled up into channels.
      referrers: referrerRows
    });
  } catch (error) {
    console.error("Visitor analytics query failed:", error);
    return res.status(500).json({success: false, message: "Unable to load visitor analytics."});
  }
};