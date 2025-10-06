// controllers/holidayMode.controller.js
const HolidayMode = require('../modals/holidayModal.modal');

// Get holiday mode settings
exports.getHolidayMode = async (req, res) => {
  try {
    const settings = await HolidayMode.getSettings();
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch holiday mode',
      error: error.message
    });
  }
};

// Toggle holiday mode on/off
exports.toggleHolidayMode = async (req, res) => {
  try {
    const settings = await HolidayMode.getSettings();
    settings.isActive = !settings.isActive;
    
    if (settings.isActive && !settings.startDate) {
      settings.startDate = new Date();
    }
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: `Holiday mode ${settings.isActive ? 'enabled' : 'disabled'}`,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle holiday mode',
      error: error.message
    });
  }
};

// Update holiday mode settings
exports.updateHolidayMode = async (req, res) => {
  try {
    const settings = await HolidayMode.getSettings();
    
    const { isActive, message, startDate, endDate, allowBrowsing, allowOrders } = req.body;
    
    if (isActive !== undefined) settings.isActive = isActive;
    if (message) settings.message = message;
    if (startDate) settings.startDate = startDate;
    if (endDate) settings.endDate = endDate;
    if (allowBrowsing !== undefined) settings.allowBrowsing = allowBrowsing;
    if (allowOrders !== undefined) settings.allowOrders = allowOrders;
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
};