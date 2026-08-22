const mongoose = require("mongoose");

const siteSettingSchema = new mongoose.Schema(
  {
    reviewsEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    couponsEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    // Reserved for future feature flags
    ratingsOnProductCard: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Ensure only one settings document exists
siteSettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("SiteSetting", siteSettingSchema);
