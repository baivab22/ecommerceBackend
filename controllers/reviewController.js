const mongoose = require("mongoose");
const Review = require("../modals/review.modal");
const SiteSetting = require("../modals/siteSetting.modal");
const Orders = require("../modals/orderModal");

// ── Helpers ────────────────────────────────────────────────────────────────

const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (_err) {
    return null;
  }
};

// Convert an uploaded file into a public path relative to /uploads
const toMediaPath = (file) =>
  String(file.mimetype || "").startsWith("video/")
    ? `video/${file.filename}`
    : `products/${file.filename}`;

// Ratings/stats are computed over APPROVED reviews only — a review becomes
// public (and counts towards the score) only once an admin approves it.
const getReviewStats = async (productId) => {
  const productIdObject = toObjectId(productId);
  if (!productIdObject) {
    return { averageRating: 0, totalReviews: 0, distribution: {} };
  }

  const match = { product: productIdObject, isActive: true, status: "APPROVED" };

  const [result] = await Review.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const distributionRows = await Review.aggregate([
    { $match: match },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  const distribution = {};
  [1, 2, 3, 4, 5].forEach((star) => {
    const row = distributionRows.find((item) => item._id === star);
    distribution[star] = row ? row.count : 0;
  });

  return {
    averageRating: result ? Math.round(result.averageRating * 10) / 10 : 0,
    totalReviews: result ? result.totalReviews : 0,
    distribution,
  };
};

// ── Public endpoints ───────────────────────────────────────────────────────

// GET /api/review/product/:productId
// Returns APPROVED reviews for everyone; the logged-in user also always
// receives their own review so they can see/edit its moderation state.
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!toObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product id", data: [] });
    }

    const reviews = await Review.find({
      product: productId,
      isActive: true,
      status: "APPROVED",
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(100);

    // Include the caller's own review even when still pending/rejected
    const userId = req.user?.userId;
    let ownReview = null;
    if (userId && toObjectId(userId)) {
      ownReview = await Review.findOne({
        product: productId,
        user: userId,
        isActive: true,
      }).populate("user", "name email");

      if (
        ownReview &&
        !reviews.some((item) => String(item.id) === String(ownReview.id))
      ) {
        reviews.unshift(ownReview);
      }
    }

    const stats = await getReviewStats(productId);

    res.status(200).json({
      message: "Successfully retrieved product reviews",
      data: reviews,
      ...stats,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving product reviews",
      error: error.message,
    });
  }
};

// GET /api/review/settings — storefront reads this to show/hide the feature
exports.getReviewSettings = async (_req, res) => {
  try {
    const settings = await SiteSetting.getSettings();
    res.status(200).json({
      message: "Successfully retrieved review settings",
      data: {
        reviewsEnabled: settings.reviewsEnabled,
        ratingsOnProductCard: settings.ratingsOnProductCard,
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving review settings",
      error: error.message,
      success: false,
    });
  }
};

// ── Authenticated endpoints ────────────────────────────────────────────────

// POST /api/review  (multipart: productId, rating, comment, images[], video)
exports.addReview = async (req, res) => {
  try {
    const settings = await SiteSetting.getSettings();
    if (!settings.reviewsEnabled) {
      return res.status(403).json({
        message: "Reviews are currently disabled",
        success: false,
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Please login to write a review",
        success: false,
      });
    }

    const { productId, rating, comment, removedImages, removeVideo } = req.body;
    const parsedRating = Number(rating);

    if (!toObjectId(productId)) {
      return res.status(400).json({
        message: "Invalid product id",
        success: false,
      });
    }

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        message: "Rating must be a whole number between 1 and 5",
        success: false,
      });
    }

    // Verified purchase = confirmed order by this user containing this product
    const purchasedOrder = await Orders.findOne({
      userId,
      isConfirmed: true,
      "products.productId": productId,
    }).select("_id");

    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });

    // Merge media: start from what's stored, drop removals, append new uploads
    let images = existingReview?.images?.length
      ? [...existingReview.images]
      : [];
    let video = existingReview?.video || "";

    if (removedImages) {
      const removedList = Array.isArray(removedImages)
        ? removedImages
        : [removedImages];
      images = images.filter((path) => !removedList.includes(path));
    }

    if (String(removeVideo) === "true") {
      video = "";
    }

    const uploadedImages =
      req.files?.images?.map(toMediaPath).filter(Boolean) || [];
    const uploadedVideo = req.files?.video?.[0];

    images = [...images, ...uploadedImages].slice(0, 5);
    if (uploadedVideo) {
      video = toMediaPath(uploadedVideo);
    }

    const reviewData = {
      rating: parsedRating,
      comment: String(comment || "").trim().slice(0, 1000),
      isVerifiedPurchase: Boolean(purchasedOrder),
      images,
      video,
      // Every save (new or edited) goes back into the moderation queue
      status: "PENDING",
    };

    const review = await Review.findOneAndUpdate(
      { product: productId, user: userId },
      { $set: reviewData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("user", "name email");

    res.status(201).json({
      message:
        "Thank you! Your review was submitted and is awaiting admin approval.",
      data: review,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error saving review",
      error: error.message,
      success: false,
    });
  }
};

// DELETE /api/review/:reviewId — owner or admin
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.userId;
    const isAdmin = String(req.user?.role || "").toUpperCase() === "ADMIN";

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
        success: false,
      });
    }

    if (!isAdmin && String(review.user) !== String(userId)) {
      return res.status(403).json({
        message: "You can only delete your own reviews",
        success: false,
      });
    }

    await review.deleteOne();

    const stats = await getReviewStats(review.product);

    res.status(200).json({
      message: "Review deleted successfully",
      ...stats,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting review",
      error: error.message,
      success: false,
    });
  }
};

// ── Admin endpoints ────────────────────────────────────────────────────────

// GET /api/review/admin/all?status=PENDING&page=1&limit=20 — moderation queue
exports.getAllReviewsAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);

    const filter = {};
    if (status && REVIEW_STATUSES.includes(String(status).toUpperCase())) {
      filter.status = String(status).toUpperCase();
    }

    const [reviews, total, counts] = await Promise.all([
      Review.find(filter)
        .populate("user", "name email")
        .populate("product", "name image")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(filter),
      Review.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    counts.forEach((row) => {
      statusCounts[row._id] = row.count;
    });

    res.status(200).json({
      message: "Successfully retrieved reviews",
      data: reviews,
      total,
      page,
      limit,
      statusCounts,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving reviews",
      error: error.message,
      success: false,
    });
  }
};

// PUT /api/review/admin/:reviewId/status { status: 'APPROVED' | 'REJECTED' | 'PENDING' }
exports.moderateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;
    const normalized = String(status || "").toUpperCase();

    if (!REVIEW_STATUSES.includes(normalized)) {
      return res.status(400).json({
        message: `status must be one of ${REVIEW_STATUSES.join(", ")}`,
        success: false,
      });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $set: { status: normalized } },
      { new: true }
    ).populate("user", "name email");

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
        success: false,
      });
    }

    const stats = await getReviewStats(review.product);

    res.status(200).json({
      message: `Review ${normalized.toLowerCase()} successfully`,
      data: review,
      ...stats,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error moderating review",
      error: error.message,
      success: false,
    });
  }
};

// PUT /api/review/settings { reviewsEnabled } — dashboard toggle
exports.updateReviewSettings = async (req, res) => {
  try {
    const { reviewsEnabled } = req.body;

    if (typeof reviewsEnabled !== "boolean") {
      return res.status(400).json({
        message: "reviewsEnabled must be a boolean",
        success: false,
      });
    }

    const settings = await SiteSetting.getSettings();
    settings.reviewsEnabled = reviewsEnabled;
    await settings.save();

    res.status(200).json({
      message: `Reviews ${reviewsEnabled ? "enabled" : "disabled"} successfully`,
      data: {
        reviewsEnabled: settings.reviewsEnabled,
        ratingsOnProductCard: settings.ratingsOnProductCard,
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating review settings",
      error: error.message,
      success: false,
    });
  }
};
