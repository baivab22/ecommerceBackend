const multer = require("multer");
const {
  createBanner,
  getAllBanner,
  deleteBannerImage,
} = require("../controllers/bannerController");
const express = require("express");
const bannerUpload = require("../handlers/multerBanner.handler");

const router = express.Router();

const cpUploadBanner = bannerUpload.fields([
  { name: "desktopBannerImage", maxCount: 12 },
  { name: "mobileBannerImage", maxCount: 12 },
  { name: "bannerImage", maxCount: 12 },
]);

const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads", "banners");

// Wraps multer so a rejected upload answers with JSON instead of the default
// HTML error page, and so any partially written files are cleaned up.
const handleBannerUpload = (req, res, next) => {
  cpUploadBanner(req, res, (error) => {
    if (error) {
      const written = Object.values(req.files || {})
        .flat()
        .filter(Boolean);

      written.forEach((file) => {
        fs.promises
          .unlink(path.join(uploadDir, file.filename))
          .catch(() => {});
      });

      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Banner image must be 10 MB or smaller."
          : error.message || "Banner upload failed.";

      return res.status(400).json({ message });
    }
    next();
  });
};

router.post("/banner/new", handleBannerUpload, createBanner);
router.get("/banner", getAllBanner);
router.delete("/banner/:imageName", deleteBannerImage);

module.exports = router;
