const mongoose = require("mongoose");

const restockNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Email snapshot taken at subscribe time so the notification can still be
    // delivered even if the user record is later removed or renamed.
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "cancelled"],
      default: "pending",
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Only ONE pending subscription per (user, product). Sent/cancelled records are
// excluded from the index so a user can re-subscribe on the next stockout.
restockNotificationSchema.index(
  { userId: 1, productId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

// Fast lookup of everyone waiting for a specific product.
restockNotificationSchema.index({ productId: 1, status: 1 });

module.exports = mongoose.model(
  "RestockNotification",
  restockNotificationSchema
);
