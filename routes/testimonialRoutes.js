const express = require("express");
const multer = require("multer");
const {
  createTestimonial,
  getAllTestimonial,
  deleteTestimonial,
  updatedTestimonial,
  getTestimonialDetailsById,
} = require("../controllers/testimonialController");

const router = express.Router();

// Multer storage for testimonials
const storaget = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/testimonial");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const uploadTestimonial = multer({ storage: storaget });

// Routes
router.post("/testimonial/new", uploadTestimonial.array("testimonialImage", 12), createTestimonial);
router.get("/testimonial", getAllTestimonial);
router.get("/testimonial/:testimonialId", getTestimonialDetailsById);
router.delete("/testimonial/:testimonialId", deleteTestimonial);

// ✅ FIXED: use multer + correct param name
router.patch("/testimonial/:testimonialId", uploadTestimonial.array("testimonialImage", 12), updatedTestimonial);

module.exports = router;
