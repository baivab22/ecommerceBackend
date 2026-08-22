const SiteSetting = require("../modals/siteSetting.modal");

// GET /api/features/settings — public; storefront reads this to show/hide features
exports.getFeatureSettings = async (_req, res) => {
  try {
    const settings = await SiteSetting.getSettings();
    res.status(200).json({
      message: "Successfully retrieved feature settings",
      data: {
        reviewsEnabled: settings.reviewsEnabled,
        couponsEnabled: settings.couponsEnabled,
        ratingsOnProductCard: settings.ratingsOnProductCard,
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving feature settings",
      error: error.message,
      success: false,
    });
  }
};

// PUT /api/features/settings — admin dashboard toggles
exports.updateFeatureSettings = async (req, res) => {
  try {
    const { reviewsEnabled, couponsEnabled, ratingsOnProductCard } = req.body;

    const updates = {};
    for (const [key, value] of Object.entries({
      reviewsEnabled,
      couponsEnabled,
      ratingsOnProductCard,
    })) {
      if (value === undefined) continue;
      if (typeof value !== "boolean") {
        return res.status(400).json({
          message: `${key} must be a boolean`,
          success: false,
        });
      }
      updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide at least one feature flag to update (reviewsEnabled, couponsEnabled, ratingsOnProductCard)",
        success: false,
      });
    }

    const settings = await SiteSetting.getSettings();
    Object.assign(settings, updates);
    await settings.save();

    res.status(200).json({
      message: "Feature settings updated successfully",
      data: {
        reviewsEnabled: settings.reviewsEnabled,
        couponsEnabled: settings.couponsEnabled,
        ratingsOnProductCard: settings.ratingsOnProductCard,
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating feature settings",
      error: error.message,
      success: false,
    });
  }
};
