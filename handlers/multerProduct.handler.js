const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads/products directory exists
const uploadDirProducts = path.join(__dirname, "..", "uploads", "products");
if (!fs.existsSync(uploadDirProducts)) {
  fs.mkdirSync(uploadDirProducts, { recursive: true });
}

// Ensure uploads/video directory exists
const uploadDirVideo = path.join(__dirname, "..", "uploads", "video");
if (!fs.existsSync(uploadDirVideo)) {
  fs.mkdirSync(uploadDirVideo, { recursive: true });
}

const storageProducts = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirProducts);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const storageVideo = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirVideo);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const isAllowedImage = (mimetype) =>
  /^image\/(png|jpe?g|gif|webp|jfif|pjpeg|x-png)$/i.test(mimetype || "");

const isAllowedVideo = (mimetype) =>
  /^video\/(mp4|webm|quicktime|x-msvideo)$/i.test(mimetype || "");

const productUpload = multer({
  storage: storageProducts,
  fileFilter: (req, file, cb) => {
    if (!isAllowedImage(file.mimetype) && !isAllowedVideo(file.mimetype)) {
      return cb(
        new Error(`File type not supported: ${file.mimetype || "unknown"}`),
        false
      );
    }
    return cb(null, true);
  },
});

const videoUpload = multer({
  storage: storageVideo,
  fileFilter: (req, file, cb) => {
    if (!isAllowedVideo(file.mimetype)) {
      return cb(
        new Error(`Video type not supported: ${file.mimetype || "unknown"}`),
        false
      );
    }
    return cb(null, true);
  },
});

const variantUpload = multer({
  storage: storageProducts,
  fileFilter: (req, file, cb) => {
    if (!isAllowedImage(file.mimetype)) {
      return cb(
        new Error(`Image type not supported: ${file.mimetype || "unknown"}`),
        false
      );
    }
    return cb(null, true);
  },
});

module.exports = { productUpload, videoUpload, variantUpload };
