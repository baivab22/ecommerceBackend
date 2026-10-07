/**
 * End-to-end verification of the visitor analytics pipeline against the real
 * database. Inserts synthetic events, then runs the exact aggregations the
 * dashboard uses.
 *
 *   node scripts/verify-analytics-pipeline.js
 *
 * Synthetic documents are removed afterwards.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const VisitorEvent = require("../modals/visitorEvent.modal");
const { resolveWindow, BUSINESS_TZ, RANGES } = require("../utils/analyticsTime");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const pad = (n) => String(n).padStart(2, "0");

async function main() {
  await mongoose.connect(process.env.DBHOST);
  console.log("connected\n");

  const now = new Date();
  const tag = `__verify_${now.getTime()}`;

  // Clear anything left behind by a previous interrupted run.
  await VisitorEvent.deleteMany({ visitorId: { $regex: "^__verify" } });

  const events = [];
  const add = (minutesAgo, visitorId, sessionId, extra = {}) =>
    events.push({
      visitorId,
      sessionId,
      path: extra.path || "/",
      referrer: extra.referrer,
      device: extra.device || "desktop",
      createdAt: new Date(now.getTime() - minutesAgo * MINUTE)
    });

  // Visitor A: 4 page views in one session, 20 minutes ago.
  add(20, `${tag}_visA`, `${tag}_sessA`, { path: "/" });
  add(19, `${tag}_visA`, `${tag}_sessA`, { path: "/product/1" });
  add(18, `${tag}_visA`, `${tag}_sessA`, { path: "/product/2" });
  add(17, `${tag}_visA`, `${tag}_sessA`, { path: "/cart" });

  // Visitor B: exactly ONE page view, 10 minutes ago  -> single-page visit
  add(10, `${tag}_visB`, `${tag}_sessB`, { path: "/product/9", referrer: "https://www.google.com/search?q=x" });

  // Visitor C: one page view 3 hours ago, from Facebook
  add(180, `${tag}_visC`, `${tag}_sessC`, { path: "/", referrer: "https://l.facebook.com/l.php", device: "mobile" });

  // Visitor D: one page view 2 days ago
  add(2880, `${tag}_visD`, `${tag}_sessD`, { path: "/" });

  await VisitorEvent.insertMany(events);
  console.log(`inserted ${events.length} synthetic events (tag: ${tag})\n`);

  try {
    for (const range of Object.keys(RANGES)) {
      const { config, start, end } = resolveWindow(range, now);
      const match = { createdAt: { $gte: start, $lte: end }, visitorId: { $regex: "^__verify" } };

      const [summary] = await VisitorEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            pageViews: { $sum: 1 },
            visitors: { $addToSet: "$visitorId" },
            sessions: { $addToSet: "$sessionId" }
          }
        },
        {
          $project: {
            _id: 0,
            pageViews: 1,
            uniqueVisitors: { $size: "$visitors" },
            sessions: { $size: "$sessions" }
          }
        }
      ]);

      const buckets = await VisitorEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: config.bucket === "minute" ? "%Y-%m-%dT%H:%M" : config.bucket === "hour" ? "%Y-%m-%dT%H:00" : "%Y-%m-%d",
                date: "$createdAt",
                timezone: BUSINESS_TZ
              }
            },
            pageViews: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const total = summary?.pageViews ?? 0;
      console.log(
        `${range.padEnd(6)} ${total > 0 ? "DATA" : "EMPTY".padEnd(6)}` +
          ` pageViews=${total} visitors=${summary?.uniqueVisitors ?? 0} ` +
          `sessions=${summary?.sessions ?? 0} buckets=${buckets.length}`
      );
    }

    console.log("\nexpected: hour=1 pv/1 visitor, today=5 pv/3 visitors, week/month/year=6 pv/4 visitors");
  } finally {
    await VisitorEvent.deleteMany({ visitorId: { $regex: "^__verify" } });
    console.log("\ncleaned up synthetic events");
  }

  // Is anything in the collection at all?
  const real = await VisitorEvent.estimatedDocumentCount();
  const recent = await VisitorEvent.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 24 * HOUR) } });
  console.log(`\nreal events in collection: ${real}`);
  console.log(`real events in last 24h:  ${recent}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("FAILED:", err.message);
  process.exit(1);
});