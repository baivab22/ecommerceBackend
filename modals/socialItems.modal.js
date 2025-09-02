const mongoose = require("mongoose");

const SociaLinksSchema = new mongoose.Schema(
  {
    socialLinks: {
      instagram: String,
      tiktok: String,
      facebook: String,
    },
    specialSlogan: {
      type: String,
      trim: true,
    },
    offerText: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

exports.SocialLinks = mongoose.model("SocialLinks", SociaLinksSchema);
