const express = require("express");
const { authenticate, requireAdmin } = require("../auth");
const {
  getFeatureSettings,
  updateFeatureSettings,
} = require("../controllers/featureController");

const router = express.Router();

// Public — storefront reads this to show/hide features
router.get("/features/settings", getFeatureSettings);

// Admin dashboard toggles (authenticate must run first — requireAdmin reads req.user)
router.put("/features/settings", authenticate, requireAdmin, updateFeatureSettings);

module.exports = router;
