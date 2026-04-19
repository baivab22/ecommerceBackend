const multer = require("multer");
const {
  createBanner,
  getAllBanner,
  updateBanner,
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

router.post("/banner/new", cpUploadBanner, createBanner);
router.get("/banner", getAllBanner);
router.delete("/banner/:imageName", deleteBannerImage);

module.exports = router;
