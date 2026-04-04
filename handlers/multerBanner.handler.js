const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads/banners directory exists
const uploadDir = path.join(__dirname, "..", "uploads", "banners");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const bannerUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/png|gif|jpg|jpeg|jfif/)) {
      cb(new Error("file is not supported"), false);
    }
    cb(null, true);
    return;
  },
});

module.exports = bannerUpload;
