// const { SocialItems } = require("../modals/socialLInks.modal");

// const { SocialLinks } = require("../modals/SocialItems.modal");

const { SocialLinks } = require("../modals/socialItems.modal");
exports.createSocialLinks = async (req, res) => {
  try {
    const newSocialLinks = new SocialLinks(req.body);
    const savedContent = await newSocialLinks.save();

    res.status(201).json({
      success: true,
      message: "Social Links created successfully",
      data: savedContent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating Social links",
      error: error.message,
    });
  }
};

exports.getSocialLinks = async (req, res) => {
  try {
    const content = await SocialLinks.find();

    res.status(200).json({
      success: true,
      message: "Social links retrieved successfully",
      data: content,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving SocialLinks",
      error: error.message,
    });
  }
};
exports.deletesocialLinks = async (req, res) => {
  try {
    const deletedsocialLinks = await SocialLinks.findByIdAndDelete(
      req.params.id
    );

    if (!deletedsocialLinks) {
      return res.status(404).json({
        success: false,
        message: "SocialLinks not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "SocialLinks deleted successfully",
      data: deletedsocialLinks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting SocialLinks",
      error: error.message,
    });
  }
};
exports.updateSocialLinks = async (req, res) => {
  try {
    const updatedContent = await SocialLinks.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedContent) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Social links updated successfully",
      data: updatedContent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating content",
      error: error.message,
    });
  }
};

exports.getSocialItemById = async (req, res) => {
  try {
    const socialItem = await SocialLinks.findById(req.params.id);

    if (!socialItem) {
      return res.status(404).json({
        success: false,
        message: "Social link not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Social link retrieved successfully",
      data: socialItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving social link",
      error: error.message,
    });
  }
};
