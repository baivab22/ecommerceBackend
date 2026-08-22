const express = require("express");
const { authenticate, requireAdmin } = require("../auth");
const {
  validateCoupon,
  getAllCouponsAdmin,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/couponController");

const router = express.Router();

// Public — cart page applies a code before checkout
router.post("/coupon/validate", validateCoupon);

// Admin management (authenticate must run first — requireAdmin reads req.user)
router.get("/coupon/admin/all", authenticate, requireAdmin, getAllCouponsAdmin);
router.post("/coupon/admin/create", authenticate, requireAdmin, createCoupon);
router.put("/coupon/admin/:id", authenticate, requireAdmin, updateCoupon);
router.delete("/coupon/admin/:id", authenticate, requireAdmin, deleteCoupon);

module.exports = router;
