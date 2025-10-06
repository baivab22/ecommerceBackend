// routes/holidayMode.routes.js
const express = require('express');
const router = express.Router();
const {
  getHolidayMode,
  toggleHolidayMode,
  updateHolidayMode
} = require('../controllers/holidayMode.controller');




// @route   GET /api/holiday-mode
// @desc    Get current holiday mode settings
// @access  Public
router.get('/holiday-mode', getHolidayMode);

// @route   POST /api/holiday-mode/toggle
// @desc    Toggle holiday mode on/off
// @access  Admin (add auth middleware if needed)
router.post('/holiday-mode/toggle', toggleHolidayMode);

// @route   PUT /api/holiday-mode/update
// @desc    Update holiday mode settings
// @access  Admin (add auth middleware if needed)
router.put('/holiday-mode/update', updateHolidayMode);

module.exports = router;