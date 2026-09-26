const fs = require("fs/promises");
const path = require("path");
const Testimonial = require("../modals/testimonial.modal");

const uploadDirectory = path.join(__dirname, "..", "uploads", "testimonial");
const maxImageSize = 5 * 1024 * 1024;

const getUploadedFiles = (req, fieldName) => {
  if (Array.isArray(req.files)) {
    return req.files.filter((file) => file.fieldname === fieldName);
  }
  return req.files?.[fieldName] || [];
};

const getAllRequestFiles = (req) => {
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files || {}).flat();
};

const removeRequestFiles = async (req) => {
  await Promise.allSettled(
    getAllRequestFiles(req).map(async (file) => {
      if (!file?.filename) return;
      try {
        await fs.unlink(path.join(uploadDirectory, path.basename(file.filename)));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    })
  );
};

const getExistingMediaType = (testimonial) => {
  if (testimonial.testimonialMediaType === "video" || testimonial.testimonialVideo) {
    return "video";
  }
  return "image";
};

const normalizeMediaType = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (normalized !== "image" && normalized !== "video") {
    const error = new Error("Media type must be either image or video.");
    error.status = 400;
    throw error;
  }
  return normalized;
};

const validateUploadedMedia = (imageFiles, videoFiles, requestedMediaType) => {
  if (imageFiles.length > 0 && videoFiles.length > 0) {
    const error = new Error("Upload either a testimonial photo or a video.");
    error.status = 400;
    throw error;
  }

  if (imageFiles.some((file) => file.size > maxImageSize)) {
    const error = new Error("Testimonial photos must be 5 MB or smaller.");
    error.status = 400;
    throw error;
  }

  if (imageFiles.length === 0 && videoFiles.length === 0) return undefined;

  const uploadedMediaType = imageFiles.length > 0 ? "image" : "video";
  if (requestedMediaType && requestedMediaType !== uploadedMediaType) {
    const error = new Error(
      `The selected ${requestedMediaType} upload does not match the media type.`
    );
    error.status = 400;
    throw error;
  }

  return uploadedMediaType;
};

const removeStoredMedia = async (fileNames, excludedTestimonialId) => {
  const names = [...new Set((fileNames || []).filter(Boolean))];

  await Promise.allSettled(
    names.map(async (fileName) => {
      const safeName = path.basename(fileName);
      const stillReferenced = await Testimonial.exists({
        _id: { $ne: excludedTestimonialId },
        $or: [
          { testimonialImage: safeName },
          { testimonialVideo: safeName },
        ],
      });

      if (stillReferenced) return;

      try {
        await fs.unlink(path.join(uploadDirectory, safeName));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    })
  );
};

exports.createTestimonial = async (req, res) => {
  try {
    const imageFiles = getUploadedFiles(req, "testimonialImage");
    const videoFiles = getUploadedFiles(req, "testimonialVideo");
    const requestedMediaType = normalizeMediaType(
      req.body.testimonialMediaType
    );
    const mediaType = validateUploadedMedia(
      imageFiles,
      videoFiles,
      requestedMediaType
    );

    if (!mediaType) {
      return res.status(400).json({
        message: "Choose a testimonial photo or video.",
      });
    }

    const testimonial = new Testimonial({
      testimonialImage:
        mediaType === "image" ? imageFiles.map((file) => file.filename) : [],
      testimonialVideo:
        mediaType === "video" ? videoFiles[0].filename : "",
      testimonialMediaType: mediaType,
      testimonialDescription:
        String(req.body.testimonialDescription || "").trim(),
      testimonialBy: String(req.body.testimonialBy || "").trim(),
    });

    const data = await testimonial.save();
    return res.status(201).json({
      message: "Testimonial created successfully",
      data,
    });
  } catch (error) {
    await removeRequestFiles(req);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Error creating testimonial",
    });
  }
};

exports.updatedTestimonial = async (req, res) => {
  try {
    const testimonialId = req.params.testimonialId;
    const existingTestimonial = await Testimonial.findById(testimonialId);

    if (!existingTestimonial) {
      await removeRequestFiles(req);
      return res.status(404).json({ message: "Testimonial not found" });
    }

    const imageFiles = getUploadedFiles(req, "testimonialImage");
    const videoFiles = getUploadedFiles(req, "testimonialVideo");
    const requestedMediaType = normalizeMediaType(
      req.body.testimonialMediaType
    );
    const uploadedMediaType = validateUploadedMedia(
      imageFiles,
      videoFiles,
      requestedMediaType
    );
    const updateFields = {};

    if (req.body.testimonialDescription !== undefined) {
      updateFields.testimonialDescription = String(
        req.body.testimonialDescription || ""
      ).trim();
    }
    if (req.body.testimonialBy !== undefined) {
      updateFields.testimonialBy = String(req.body.testimonialBy || "").trim();
    }

    if (uploadedMediaType === "image") {
      updateFields.testimonialImage = imageFiles.map((file) => file.filename);
      updateFields.testimonialVideo = "";
      updateFields.testimonialMediaType = "image";
    } else if (uploadedMediaType === "video") {
      updateFields.testimonialImage = [];
      updateFields.testimonialVideo = videoFiles[0].filename;
      updateFields.testimonialMediaType = "video";
    } else if (
      requestedMediaType &&
      requestedMediaType !== getExistingMediaType(existingTestimonial)
    ) {
      return res.status(400).json({
        message: `Upload a ${requestedMediaType} before saving this change.`,
      });
    }

    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      testimonialId,
      updateFields,
      { new: true, runValidators: true }
    );

    if (uploadedMediaType) {
      const mediaToRemove = [
        ...(existingTestimonial.testimonialImage || []),
        existingTestimonial.testimonialVideo,
      ];
      await removeStoredMedia(mediaToRemove, updatedTestimonial._id);
    }

    return res.status(200).json({
      message: "Testimonial updated successfully",
      data: updatedTestimonial,
    });
  } catch (error) {
    await removeRequestFiles(req);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Error updating testimonial",
    });
  }
};

exports.getAllTestimonial = async (req, res) => {
  try {
    const data = await Testimonial.find().sort({ _id: -1 });
    return res.status(200).json({
      message: "Testimonials fetched successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching testimonials" });
  }
};

exports.deleteTestimonial = async (req, res) => {
  try {
    const deletedTestimonial = await Testimonial.findByIdAndDelete(
      req.params.testimonialId
    );

    if (!deletedTestimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    await removeStoredMedia(
      [
        ...(deletedTestimonial.testimonialImage || []),
        deletedTestimonial.testimonialVideo,
      ],
      deletedTestimonial._id
    );

    return res.status(200).json({
      message: "Testimonial deleted successfully",
      data: deletedTestimonial,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting testimonial" });
  }
};

exports.getTestimonialDetailsById = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(
      req.params.testimonialId
    );

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    return res.status(200).json({
      message: "Testimonial fetched successfully",
      data: testimonial,
    });
  } catch (error) {
    return res.status(400).json({ message: "Error fetching testimonial" });
  }
};
