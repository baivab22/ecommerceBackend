const Banner = require("../modals/banner.modal");

const fs = require("fs/promises");
const path = require("path");


// const findOrCreateBanner = async () => {
//   let existingBanner = await Banner.findOne();

//   if (!existingBanner) {
//     // If no banner exists, create a new one
//     existingBanner = await new Banner();
//     await existingBanner.save();
//   }

//   return existingBanner;
// };

exports.createBanner = async (req, res, next) => {
  try {
    console.log("hitted banner", req.files);

    let banner = await Banner.findOne();

    if (!banner) {
      // If no banner exists, create a new one
      banner = new Banner();
    }

    // Get image filenames from the uploaded files
    const fileNames = req.files.map((file) => file.filename);

    console.log(fileNames, "fileNames hai ta");

    // Add image filenames to the banner's bannerImages array
    banner.bannerImage = [...(banner.bannerImage || []), ...fileNames];

    // Save the banner
    const datas = await banner.save();

    console.log(datas, "from banner");

    // const fileNames = req.files.map((file) => file.filename);

    // const bannerImage = new Banner({ bannerImage: fileNames });
    // const datas = await bannerImage.save();

    res.status(201).json({
      message: "success fully creaete banner",
      data: datas,
    });
  } catch (error) {}
};

exports.getAllBanner = async (req, res, next) => {
  const data = await Banner.find();
  res.status(201).json({ message: "success fully get Banner", data: data });
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
    await banner.save();

    // Try deleting file from uploads folder
    const uploadDirs = ["uploads"];
    let fileDeleted = false;
    let deletedPath = null;

    for (const dir of uploadDirs) {
      const filePath = path.join(__dirname, "..", dir, safeName);
      try {
        await fs.unlink(filePath);
        fileDeleted = true;
        deletedPath = filePath;
        break;
      } catch (err) {
        if (err.code === "ENOENT") continue; // File not found — try next
      }
    }

    return res.status(200).json({
      message: "Banner image deleted successfully",
      removedFromDb: true,
      fileDeleted,
      deletedPath,
      remainingImages: banner.bannerImage,
    });
  } catch (error) {
    console.error("deleteBannerImage error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
