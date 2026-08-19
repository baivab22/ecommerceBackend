const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema({
  testimonialImage: {
    type: [String],
  },
  testimonialDescription: String,
  testimonialBy: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model("Testimonial", testimonialSchema);
