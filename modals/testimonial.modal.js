const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema({
  testimonialImage: {
    type: [String],
    default: [],
  },
  testimonialVideo: {
    type: String,
    default: '',
  },
  testimonialMediaType: {
    type: String,
    enum: ["image", "video"],
    default: "image",
  },
  testimonialDescription: {
    type: String,
    default: "",
    trim: true,
  },
  testimonialBy: {
    type: String,
    default: "",
    trim: true,
  },
});

module.exports = mongoose.model("Testimonial", testimonialSchema);
