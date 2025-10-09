const Testimonial = require("../modals/testimonial.modal");

exports.updatedTestimonial = async (req, res) => {
  try {
    const { testimonialDescription } = req.body;
    const testimonialId = req.params.testimonialId;

    console.log("Incoming body:", req.body);
    console.log("Incoming files:", req.files);

    // Extract image filenames if new images are uploaded
    let testimonialImage = [];
    if (req.files && req.files.length > 0) {
      testimonialImage = req.files.map((file) => file.filename);
    }

    // Build update object dynamically
    const updateFields = {};
    if (testimonialDescription) updateFields.testimonialDescription = testimonialDescription;
    if (testimonialImage.length > 0) updateFields.testimonialImage = testimonialImage;

    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      testimonialId,
      updateFields,
      { new: true }
    );

    if (!updatedTestimonial) {
      return res.status(404).json({ error: "Testimonial not found" });
    }

    res.status(200).json({
      message: "Testimonial updated successfully",
      data: updatedTestimonial,
    });
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.createTestimonial = async (req, res, next) => {
  try {
    console.log("hitted Testimonial", req.files);

    const fileNames = req.files.map((file) => file.filename);

    // console.log(datas, "from Test");

    const testimonial = new Testimonial({
      testimonialImage: fileNames,
      testimonialDescription: req.body.testimonialDescription,
    });

    const datas = await testimonial.save();
    res.status(201).json({
      message: "success fully created testimonial",
      data: datas,
    });
  } catch (error) {}
};

exports.getAllTestimonial = async (req, res, next) => {
  const data = await Testimonial.find();
  res
    .status(201)
    .json({ message: "success fully got Testimonial", data: data });
};

exports.deleteTestimonial = async (req, res, next) => {
  try {
    const deleteTestimonialData = await Testimonial.findByIdAndDelete(
      req.params.testimonialId
    );

    if (!deleteTestimonialData) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    res.status(200).json({
      message: "Successfully deleted Testimonial",
      data: deleteTestimonialData,
    });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getTestimonialDetailsById = async (req, res, next) => {
  try {
    const testimonialId = req.params.testimonialId;
    const tesimonialDetails = await Testimonial.findById(testimonialId);
    // console.log(subCategoryDetails, "subCategorydetails");

    if (!tesimonialDetails) {
      return res.status(404).json({ error: "testimonial not found" });
    }

    res.status(201).json({
      message: "successfully get testimonial Details",
      data: tesimonialDetails,
    });
  } catch (error) {
    res.status(400).json({ message: "error fetching subCategory detail" });
  }
};
