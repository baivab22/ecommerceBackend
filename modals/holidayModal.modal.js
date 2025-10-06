// models/HolidayMode.js
const mongoose = require('mongoose');

const holidayModeSchema = new mongoose.Schema({
  isActive: {
    type: Boolean,
    default: false,
    required: true
  },
  message: {
    type: String,
    default: 'We are currently on holiday. Orders will be processed after we return.',
    maxlength: 500
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  allowBrowsing: {
    type: Boolean,
    default: true
  },
  allowOrders: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure only one holiday mode document exists
holidayModeSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('HolidayMode', holidayModeSchema);