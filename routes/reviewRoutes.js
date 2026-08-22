const express = require("express");
const { authenticate, requireAdmin, optionalAuth } = require("../auth");
const { uploadReviewMedia } = require("../handlers/multerReview.handler");
const {
  getProductReviews,
  getReviewSettings,
  addReview,
  deleteReview,
  getAllReviewsAdmin,
  moderateReviewStatus,
  updateReviewSettings,
} = require("../controllers/reviewController");

const router = express.Router();

// Multer errors (bad type / too large) → clean 400 instead of a stack trace
const handleUpload = (req, res, next) => {
  uploadReviewMedia(req, res, (error) => {
    if (error) {
      return res
        .status(400)
        .json({ message: error.message || "Upload failed", success: false });
    }
    next();
  });
};

// Public
router.get("/review/product/:productId", optionalAuth, getProductReviews);
router.get("/review/settings", getReviewSettings);

// Authenticated
router.post("/review", authenticate, handleUpload, addReview);
router.delete("/review/:reviewId", authenticate, deleteReview);

// Admin moderation (authenticate must run first — requireAdmin reads req.user)
router.get("/review/admin/all", authenticate, requireAdmin, getAllReviewsAdmin);
router.put("/review/admin/:reviewId/status", authenticate, requireAdmin, moderateReviewStatus);
router.put("/review/settings", authenticate, requireAdmin, updateReviewSettings);

module.exports = router;
