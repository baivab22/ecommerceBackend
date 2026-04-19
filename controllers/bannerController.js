const Banner = require("../modals/banner.modal");
const fs = require("fs/promises");
const path = require("path");

exports.createBanner = async (req, res, next) => {
  try {
    const uploadedFiles = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).reduce((acc, files) => acc.concat(files), []);

    console.log("Banner upload - files received:", uploadedFiles.length || 0);

    let banner = await Banner.findOne();

    if (!banner) {
      banner = new Banner();
    }

    const filesByField = uploadedFiles.reduce((acc, file) => {
      if (!acc[file.fieldname]) {
        acc[file.fieldname] = [];
      }

      acc[file.fieldname].push(file.filename);
      return acc;
    }, {});

    const desktopFiles = filesByField.desktopBannerImage || filesByField.bannerImage || [];
    const mobileFiles = filesByField.mobileBannerImage || [];

    banner.desktopBannerImage = [
      ...(banner.desktopBannerImage || []),
      ...desktopFiles,
    ];
    banner.mobileBannerImage = [
      ...(banner.mobileBannerImage || []),
      ...mobileFiles,
    ];

    // Keep the legacy field in sync with desktop banners for backward compatibility.
    banner.bannerImage = [...(banner.bannerImage || []), ...desktopFiles];

    // Save the banner
    const savedBanner = await banner.save();
    console.log("Banner saved:", savedBanner);

    res.status(201).json({
      message: "successfully created banner",
      data: savedBanner,
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    res.status(500).json({
      message: "Failed to create banner",
      error: error.message,
    });
  }
};

exports.getAllBanner = async (req, res, next) => {
  try {
    const data = await Banner.find();
    res.status(200).json({
      message: "successfully retrieved banners",
      data: data,
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    });
  }
};

exports.deleteBannerImage = async (req, res) => {
  try {
    const { imageName } = req.params;

    if (!imageName) {
      return res.status(400).json({ message: "imageName parameter is required" });
    }

    const safeName = path.basename(imageName);

    // Find the existing banner document
    const banner = await Banner.findOne();
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    const desktopImages = banner.desktopBannerImage || [];
    const mobileImages = banner.mobileBannerImage || [];
    const legacyImages = banner.bannerImage || [];

    const nextDesktopImages = desktopImages.filter((img) => img !== safeName);
    const nextMobileImages = mobileImages.filter((img) => img !== safeName);
    const nextLegacyImages = legacyImages.filter((img) => img !== safeName);

    if (
      nextDesktopImages.length === desktopImages.length &&
      nextMobileImages.length === mobileImages.length &&
      nextLegacyImages.length === legacyImages.length
    ) {
      return res.status(404).json({ message: "Image not found in banner record" });
    }

    banner.desktopBannerImage = nextDesktopImages;
    banner.mobileBannerImage = nextMobileImages;
    banner.bannerImage = nextLegacyImages;
    const updatedBanner = await banner.save();

    // Delete file from uploads/banners folder
    const filePath = path.join(__dirname, "..", "uploads", "banners", safeName);
    try {
      await fs.unlink(filePath);
      console.log("File deleted:", filePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("Error deleting file:", err);
      }
    }

    return res.status(200).json({
      message: "Banner image deleted successfully",
      data: updatedBanner,
    });
  } catch (error) {
    console.error("deleteBannerImage error:", error);
    return res.status(500).json({
      message: "Failed to delete banner image",
      error: error.message,
    });
  }
};
