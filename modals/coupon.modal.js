const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    // "percentage" => discountValue treated as % off
    // "fixed" => discountValue treated as flat NPR amount off
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: 0,
    },
    // Cap for percentage coupons (null/0 = no cap). Ignored for fixed coupons.
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    // Minimum order subtotal required to use the coupon (0 = no minimum)
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // null = never expires
    expiresAt: {
      type: Date,
      default: null,
    },
    // Total redemption cap. 0 = unlimited
    usageLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Per-user redemption cap. 0 = unlimited per user
    usageLimitPerUser: {
      type: Number,
      default: 1,
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedByUsers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        productOrderId: String,
        discountAmount: Number,
        usedAt: { type: Date, default: Date.now },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
