const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  desktopBannerImage: {
    type: [String],
    default: [],
  },
  mobileBannerImage: {
    type: [String],
    default: [],
  },
  bannerImage: {
    type: [String],
    default: [],
  },
});

module.exports = mongoose.model("Banner", bannerSchema);
