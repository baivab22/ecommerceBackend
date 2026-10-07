const mongoose = require("mongoose");

const visitorEventSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    path: { type: String, required: true, maxlength: 500 },
    referrer: { type: String, maxlength: 500 },
    device: {
      type: String,
      enum: ["mobile", "tablet", "desktop", "unknown"],
      default: "unknown"
    },
    // First page view of a session — drives an approximate bounce-rate signal.
    isNewSession: { type: Boolean, default: false },
    // Correlation for signed-in shoppers; absent for anonymous traffic.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }
  },
  { timestamps: true }
);

visitorEventSchema.index({ createdAt: -1 });
visitorEventSchema.index({ createdAt: -1, visitorId: 1 });
visitorEventSchema.index({ createdAt: -1, path: 1 });

module.exports = mongoose.model("VisitorEvent", visitorEventSchema);
