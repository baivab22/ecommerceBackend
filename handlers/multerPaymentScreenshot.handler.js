// handlers/multerPaymentScreenshot.handler.js
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const multer = require("multer");

const PAYMENT_SCREENSHOT_FOLDER = "payment-screenshots";
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const uploadDirectory = path.join(UPLOAD_ROOT, PAYMENT_SCREENSHOT_FOLDER);

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const extensionByMimeType = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/jfif": ".jpg",
  "image/x-png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const isAllowedImage = (mimetype = "") =>
  Object.prototype.hasOwnProperty.call(
    extensionByMimeType,
    String(mimetype).toLowerCase()
  );

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension =
      extensionByMimeType[String(file.mimetype).toLowerCase()] || ".bin";
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

const uploadPaymentScreenshot = multer({
  storage,
  limits: { fileSize: MAX_SCREENSHOT_SIZE, files: 1, fields: 100 },
  fileFilter: (_req, file, callback) => {
    if (file.fieldname !== "paymentScreenshot") {
      return callback(
        new Error(
          `Unexpected file field "${file.fieldname}". Only "paymentScreenshot" is accepted.`
        )
      );
    }

    if (!isAllowedImage(file.mimetype)) {
      return callback(
        new Error(
          `Unsupported payment screenshot type: ${file.mimetype || "unknown"}. Please upload a JPG, PNG, WEBP, GIF, HEIC or HEIF image.`
        )
      );
    }

    return callback(null, true);
  },
}).single("paymentScreenshot");

const removeUploadedScreenshot = async (file) => {
  if (!file?.filename) return;
  try {
    await fs.promises.unlink(path.join(uploadDirectory, file.filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to remove payment screenshot:", error.message);
    }
  }
};

const getPaymentScreenshotFile = (req) => req.file || null;

const getPaymentScreenshotPath = (file) => {
  if (!file?.filename) return null;
  return `/uploads/${PAYMENT_SCREENSHOT_FOLDER}/${file.filename}`;
};

const handlePaymentScreenshotUpload = (req, res, next) => {
  uploadPaymentScreenshot(req, res, async (error) => {
    if (error) {
      await removeUploadedScreenshot(req.file);
      return res.status(400).json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "Payment screenshot is too large. Maximum allowed size is 5 MB."
            : error.message || "Payment screenshot upload failed.",
      });
    }
    next();
  });
};

module.exports = {
  PAYMENT_SCREENSHOT_FOLDER,
  MAX_SCREENSHOT_SIZE,
  uploadPaymentScreenshot,
  handlePaymentScreenshotUpload,
  getPaymentScreenshotFile,
  getPaymentScreenshotPath,
  removeUploadedScreenshot,
};
