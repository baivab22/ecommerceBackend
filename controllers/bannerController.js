const Banner = require("../modals/banner.modal");
const fs = require("fs/promises");
const path = require("path");

exports.createBanner = async (req, res, next) => {
  try {
    console.log("Banner upload - files received:", req.files?.length || 0);

    let banner = await Banner.findOne();

    if (!banner) {
      banner = new Banner();
    }

    // Get image filenames from the uploaded files
    const fileNames = req.files.map((file) => file.filename);
    console.log("Filenames:", fileNames);

    // Add image filenames to the banner's bannerImage array
    banner.bannerImage = [...(banner.bannerImage || []), ...fileNames];

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

    // Remove image from DB
    const oldImages = banner.bannerImage || [];
    const newImages = oldImages.filter((img) => img !== safeName);

    if (newImages.length === oldImages.length) {
      return res.status(404).json({ message: "Image not found in banner record" });
    }

    banner.bannerImage = newImages;
    const updatedBanner = await banner.save();

    // Delete file from uploads/banners folder
    const filePath = path.join(__dirname, "..", "uploads/banners", safeName);
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
