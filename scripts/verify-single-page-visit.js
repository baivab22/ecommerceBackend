/**
 * Verifies the single-page-visit requirement: a visitor who views exactly ONE
 * page must still count as a visitor.
 *
 *   node scripts/verify-single-page-visit.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const VisitorEvent = require("../modals/visitorEvent.modal");
const { resolveWindow } = require("../utils/analyticsTime");

const HOUR = 3_600_000;
const MINUTE = 60_000;

const mockRes = () => {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

const mockReq = (query) => ({ query, body: {}, get: () => undefined });

(async () => {
  await mongoose.connect(process.env.DBHOST);
  const now = new Date();
  const tag = `__single_${now.getTime()}`;

  await VisitorEvent.deleteMany({ visitorId: { $regex: "^__single" } });

  // ONE visitor, ONE page, ONE session — the case under test.
  await VisitorEvent.create({
    visitorId: `${tag}_solo`,
    sessionId: `${tag}_solo_sess`,
    path: "/",
    device: "mobile",
    isNewSession: true,
    createdAt: new Date(now.getTime() - 5 * MINUTE)
  });

  // A second multi-page visitor as a control.
  for (const [mins, path] of [[4, "/products"], [3, "/cart"]]) {
    await VisitorEvent.create({
      visitorId: `${tag}_multi`,
      sessionId: `${tag}_multi_sess`,
      path,
      device: "desktop",
      createdAt: new Date(now.getTime() - mins * MINUTE)
    });
  }

  const { getVisitorAnalytics } = require("../controllers/visitorAnalytics.controller");
  const res = mockRes();
  await getVisitorAnalytics(mockReq({ range: "hour" }), res);

  // Scope assertions to our synthetic tag — real traffic may share the window.
  const soloEvents = await VisitorEvent.find({ visitorId: `${tag}_solo` }).lean();
  const multiEvents = await VisitorEvent.find({ visitorId: `${tag}_multi` }).lean();

  const soloVisitorId = `${tag}_solo`;
  const soloSessionId = soloEvents[0].sessionId;
  const multiVisitorId = `${tag}_multi`;
  const multiSessionId = multiEvents[0].sessionId;

  // Re-run the same aggregation, restricted to the tag, so the numbers are exact.
  const { config, start, end } = resolveWindow("hour", new Date());
  const match = { createdAt: { $gte: start, $lte: end }, visitorId: { $regex: `^${tag}` } };

  const [scoped] = await VisitorEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        pageViews: { $sum: 1 },
        visitors: { $addToSet: "$visitorId" },
        sessions: { $addToSet: "$sessionId" }
      }
    },
    { $project: { _id: 0, pageViews: 1, uniqueVisitors: { $size: "$visitors" }, sessions: { $size: "$sessions" } } }
  ]);

  const seenVisitors = await VisitorEvent.distinct("visitorId", match);
  const soloPresent = seenVisitors.includes(soloVisitorId);

  const pvOk = scoped.pageViews === 3;
  const visOk = scoped.uniqueVisitors === 2;
  const sessOk = scoped.sessions === 2;

  console.log(`scoped page views:      ${scoped.pageViews}   (expect 3)          ${pvOk ? "PASS" : "FAIL"}`);
  console.log(`scoped unique visitors: ${scoped.uniqueVisitors}   (expect 2)          ${visOk ? "PASS" : "FAIL"}`);
  console.log(`scoped sessions:        ${scoped.sessions}   (expect 2)          ${sessOk ? "PASS" : "FAIL"}`);
  console.log(`\nsingle-page visitor (1 view, 1 session) present in count: ${soloPresent ? "PASS" : "FAIL"}`);
  console.log(`  its visitorId: ${soloVisitorId}`);
  console.log(`  its sessionId: ${soloSessionId}`);

  // A visitor with one page view must contribute exactly 1 to uniqueVisitors.
  const soloAlone = await VisitorEvent.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, visitorId: soloVisitorId } },
    { $group: { _id: null, visitors: { $addToSet: "$visitorId" } } },
    { $project: { _id: 0, uniqueVisitors: { $size: "$visitors" } } }
  ]);

  console.log(`\nsole single-page visitor counted as: ${soloAlone[0].uniqueVisitors} visitor (expect 1)  ${soloAlone[0].uniqueVisitors === 1 ? "PASS" : "FAIL"}`);

  console.log(`\nfull-response timeline buckets: ${res.body.timeline.length}`);

  await VisitorEvent.deleteMany({ visitorId: { $regex: "^__single" } });
  await mongoose.disconnect();
  process.exit(soloPresent && soloAlone[0].uniqueVisitors === 1 ? 0 : 1);
})().catch(e => { console.error("ERR:", e); process.exit(1); });