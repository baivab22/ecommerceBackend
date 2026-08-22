const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
      maxlength: 1000,
      trim: true,
    },
    // Uploaded media — paths relative to /uploads (e.g. "products/x.jpg", "video/y.mp4")
    images: {
      type: [String],
      default: [],
    },
    video: {
      type: String,
      default: "",
    },
    // Moderation — reviews are public only after an admin approves them
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One review per user per product — resubmitting updates the existing review
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Match house convention: expose `id` instead of `_id`
const transformId = (doc, ret) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
};

reviewSchema.set("toJSON", { transform: transformId });

module.exports = mongoose.model("Review", reviewSchema);
