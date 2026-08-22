const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Storage directories ─────────────────────────────────────────────────────
const uploadDirImages = path.join(__dirname, "..", "uploads", "products");
if (!fs.existsSync(uploadDirImages)) {
  fs.mkdirSync(uploadDirImages, { recursive: true });
}

const uploadDirVideos = path.join(__dirname, "..", "uploads", "video");
if (!fs.existsSync(uploadDirVideos)) {
  fs.mkdirSync(uploadDirVideos, { recursive: true });
}

// ── Type checks ─────────────────────────────────────────────────────────────
const isAllowedImage = (mimetype) =>
  /^image\/(png|jpe?g|gif|webp|jfif|pjpeg|x-png)$/i.test(mimetype || "");

const isAllowedVideo = (mimetype) =>
  /^video\/(mp4|webm|quicktime|x-msvideo)$/i.test(mimetype || "");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per photo
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB per video

// ── Mixed storage: photos → uploads/products, videos → uploads/video ───────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (isAllowedVideo(file.mimetype)) return cb(null, uploadDirVideos);
    if (isAllowedImage(file.mimetype)) return cb(null, uploadDirImages);
    return cb(new Error(`Unsupported file type: ${file.mimetype || "unknown"}`));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const uploadReviewMedia = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 6 },
  fileFilter: (req, file, cb) => {
    const allowed =
      isAllowedImage(file.mimetype) || isAllowedVideo(file.mimetype);

    if (!allowed) {
      return cb(
        new Error(
          `Unsupported file type for field ${file.fieldname}: ${file.mimetype || "unknown"}`
        ),
        false
      );
    }

    const limit =
      isAllowedVideo(file.mimetype) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if ((file.size || 0) > limit) {
      return cb(
        new Error(
          `${file.fieldname} exceeds the ${Math.round(limit / (1024 * 1024))}MB limit`
        ),
        false
      );
    }

    return cb(null, true);
  },
}).fields([
  { name: "images", maxCount: 5 },
  { name: "video", maxCount: 1 },
]);

module.exports = { uploadReviewMedia };
