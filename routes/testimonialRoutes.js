const express = require("express");
const fs = require("fs");
const fsPromises = require("fs/promises");
const multer = require("multer");
const path = require("path");
const { randomUUID } = require("crypto");
const { authenticate, requireAdmin } = require("../auth");
const {
  createTestimonial,
  getAllTestimonial,
  deleteTestimonial,
  updatedTestimonial,
  getTestimonialDetailsById,
} = require("../controllers/testimonialController");

const router = express.Router();
const uploadDirectory = path.join(__dirname, "..", "uploads", "testimonial");
const maxVideoSize = 50 * 1024 * 1024;

fs.mkdirSync(uploadDirectory, { recursive: true });

const isImage = (mimetype = "") =>
  /^image\/(png|jpe?g|gif|webp|jfif|pjpeg|x-png)$/i.test(mimetype);
const isVideo = (mimetype = "") =>
  /^video\/(mp4|webm|ogg|quicktime|x-msvideo)$/i.test(mimetype);

const extensionByMimeType = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/jfif": ".jpg",
  "image/x-png": ".png",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension = extensionByMimeType[file.mimetype.toLowerCase()] || ".bin";
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxVideoSize, files: 13 },
  fileFilter: (_req, file, callback) => {
    if (file.fieldname === "testimonialImage" && isImage(file.mimetype)) {
      return callback(null, true);
    }
    if (file.fieldname === "testimonialVideo" && isVideo(file.mimetype)) {
      return callback(null, true);
    }

    const expectedType =
      file.fieldname === "testimonialImage" ? "an image" : "a video";
    return callback(
      new Error(`${file.fieldname} must contain ${expectedType}.`)
    );
  },
});

const uploadedMediaFields = upload.fields([
  { name: "testimonialImage", maxCount: 12 },
  { name: "testimonialVideo", maxCount: 1 },
]);

const getUploadedFiles = (files) => {
  if (Array.isArray(files)) return files;
  return Object.values(files || {}).flat();
};

const removeUploadedFiles = async (files) => {
  await Promise.allSettled(
    getUploadedFiles(files).map(async (file) => {
      if (!file?.filename) return;
      try {
        await fsPromises.unlink(
          path.join(uploadDirectory, path.basename(file.filename))
        );
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    })
  );
};

const handleUpload = (req, res, next) => {
  uploadedMediaFields(req, res, async (error) => {
    if (error) {
      await removeUploadedFiles(req.files);
      return res.status(400).json({
        message: error.message || "Testimonial media upload failed.",
      });
    }
    next();
  });
};

router.post(
  "/testimonial/new",
  authenticate,
  requireAdmin,
  handleUpload,
  createTestimonial
);
router.get("/testimonial", getAllTestimonial);
router.get("/testimonial/:testimonialId", getTestimonialDetailsById);
router.delete(
  "/testimonial/:testimonialId",
  authenticate,
  requireAdmin,
  deleteTestimonial
);
router.patch(
  "/testimonial/:testimonialId",
  authenticate,
  requireAdmin,
  handleUpload,
  updatedTestimonial
);

module.exports = router;
