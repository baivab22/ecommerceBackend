const express = require("express");
const { authenticate, requireAdmin, optionalAuth } = require("../auth");
const {
  trackVisitor,
  getVisitorAnalytics
} = require("../controllers/visitorAnalytics.controller");

const router = express.Router();

// optionalAuth links signed-in shoppers to their events without blocking anon traffic.
router.post("/analytics/track", optionalAuth, trackVisitor);
router.get("/analytics/visitors", authenticate, requireAdmin, getVisitorAnalytics);

module.exports = router;
