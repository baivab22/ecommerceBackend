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

const productUpload = multer({
  storage: storageProducts,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/mp4|png|gif|jpg|jpeg|jfif/)) {
      cb(new Error("file is not supported"), false);
    }
    cb(null, true);
  },
});

const videoUpload = multer({
  storage: storageVideo,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/mp4/)) {
      cb(new Error("file is not supported"), false);
    }
    cb(null, true);
  },
});

module.exports = { productUpload, videoUpload };
