const Banner = require("../modals/banner.modal");

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

exports.deleteBannerImage = async (req, res, next) => {
  try {
    const { imageName } = req.params;
    if (!imageName) {
      return res.status(400).json({ message: "imageName parameter is required" });
    }

    // Sanitize filename to avoid path traversal
    const safeName = path.basename(imageName);

    // Find the banner document
    const banner = await Banner.findOne();
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    // Normalize banner images and remove the specified image
    const images = Array.isArray(banner.bannerImage) ? banner.bannerImage : [];
    const newImages = images.filter((img) => {
      if (!img) return false;
      if (typeof img === "string") return img !== safeName;
      if (typeof img === "object") {
        const filename = img.filename || img.name || img.url || "";
        return filename !== safeName;
      }
      return true;
    });

    const wasInDb = newImages.length !== images.length;
    banner.bannerImage = newImages;
    const saved = await banner.save();

    // Try deleting the physical file from a few likely upload directories
    const possibleDirs = ["banners", "banner", "products", ""]; // order: common places
    let fileDeleted = false;
    let deletedPath = null;

    for (const dir of possibleDirs) {
      // build safe absolute path
      const filePath = dir
        ? path.join(__dirname, "..", "uploads", dir, safeName)
        : path.join(__dirname, "..", "uploads", safeName);

      try {
        // check existence and unlink
        await fs.access(filePath); // throws if not exists
        await fs.unlink(filePath);
        fileDeleted = true;
        deletedPath = filePath;
        break;
      } catch (err) {
        if (err.code === "ENOENT") {
          // not found in this location — continue searching
          continue;
        } else {
          // other errors (permissions, etc.) — log and continue
          console.error("Error while deleting file:", filePath, err);
          // don't break; attempt other locations
        }
      }
    }

    return res.status(200).json({
      message: "Banner updated",
      fileDeleted,
      deletedPath,
      removedFromDb: wasInDb,
      data: saved,
    });
  } catch (error) {
    console.error("deleteBannerImage error:", error);
    return res.status(500).json({ message: "An error occurred", error: error.message });
  }
};
