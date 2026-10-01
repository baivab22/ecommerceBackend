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
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);
    cb(null, `${Date.now()}-${base || "banner"}${ext}`);
  },
});

const ALLOWED_IMAGE_MIME = /^image\/(png|jpe?g|gif|webp|jfif|pjpeg|x-png|avif|heic|heif)$/i;

const bannerUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.test(file.mimetype || "")) {
      return cb(new Error("file is not supported"), false);
    }
    cb(null, true);
  },
});

module.exports = bannerUpload;
