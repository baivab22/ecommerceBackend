const Category = require("../modals/category.modal");

exports.createCategory = async (req, res, next) => {
  try {
    const { name, subCategories } = req.body;

    const image = req.file ? req.file.path : null;

    const categoryData = new Category.Category({
      name,
      subCategories,
      image,
    });
    console.log(categoryData, "categoryData value");

    const createCategoryData = await categoryData.save();
    res.status(201).json({
      message: "Successfully created category",
      data: createCategoryData,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating category", error });
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { name, subCategories } = req.body;
    const image = req.file ? req.file.path : undefined; // If not updating image, keep existing

    const updatePayload = { name, subCategories };
    if (image) updatePayload.image = image;

    const updatedCategoryData = await Category.Category.findByIdAndUpdate(
      req.params.categoryId,
      updatePayload,
      { new: true }
    );

    res.status(200).json({
      message: "Successfully updated category",
      data: updatedCategoryData,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating category", error });
  }
};
exports.getAllCategory = async (req, res, next) => {
  try {
    const data = await Category.Category.find().populate({
      path: "subCategories",
      populate: {
        path: "subCategories", // second-level population
      },
    });

    res
      .status(200)
      .json({ message: "Successfully retrieved categories", data });
  } catch (err) {
    next(err);
  }
};
const fs = require("fs");
const path = require("path");

exports.deleteCategory = async (req, res, next) => {
  try {
    // Step 1: Find the category to get the image path
    const category = await Category.Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Step 2: Delete the image file from disk if it exists
    if (category.image) {
      const imagePath = path.join(__dirname, "..", category.image);
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Failed to delete image:", err.message);
        } else {
          console.log("Image deleted:", imagePath);
        }
      });
    }

    // Step 3: Delete the category from the database
    const deleteCategoryData = await Category.Category.deleteOne({
      _id: req.params.categoryId,
    });

    res.status(200).json({
      message: "Successfully deleted category",
      data: deleteCategoryData,
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting category", error });
  }
};

exports.addSubCategoryToCategory = async (req, res, next) => {
  try {
    const updatedCategoryDataCategory =
      await Category.Category.findOneAndUpdate(
        { _id: req.params.categoryId },
        { $push: { subCategories: req.body.subCategoryId } },
        {
          new: true,
        }
      );

    res.status(201).json({
      message: "success fully updated categories",
      data: updatedCategoryDataCategory,
    });
  } catch (error) {}
};

// for subCategory Section

exports.createSubCategory = async (req, res, next) => {
  try {
    const subCategoryData = new Category.SubCategory(req.body);
    const createSubCategoryData = await subCategoryData.save();
    res.status(201).json({
      message: "success fully create subcategories",
      data: createSubCategoryData,
    });
  } catch (error) {}
};

exports.deleteSubCategory = async (req, res, next) => {
  try {
    const deleteSubCategoryData = await Category.SubCategory.deleteOne(
      {
        _id: req.params.subCategoryId,
      },
      {
        new: true,
      }
    );

    res.status(201).json({
      message: "success fully deleted subcategory",
      data: deleteSubCategoryData,
    });
  } catch (error) {}
};

exports.updateSubCategory = async (req, res, next) => {
  try {
    const udpateSubCategoryData = await Category.SubCategory.findOneAndUpdate(
      { _id: req.params.subCategoryId },
      req.body,
      {
        new: true,
      }
    );

    res.status(201).json({
      message: "success fully udpated  subcategories",
      data: udpateSubCategoryData,
    });
  } catch (error) {}
};

exports.getAllSubCategory = async (req, res, next) => {
  const data = await Category.SubCategory.find().populate("subCategories");
  res
    .status(201)
    .json({ message: "success fully get subcategories", data: data });
};

exports.getCategoryDetailsById = async (req, res, next) => {
  try {
    console.log(req.params.id, "id");
    const categoryId = req.params.categoryId;
    const categoryDetails = await Category.Category.findById(
      categoryId
    ).populate("subCategories");
    console.log(categoryDetails, "categorydetails");

    if (!categoryDetails) {
      return res.status(404).json({ error: "category not found" });
    }

    res.status(201).json({
      message: "successfully get SubCategory Details",
      data: categoryDetails,
    });
  } catch (error) {
    res.status(400).json({ message: "error fetching category detail" });
  }
};

exports.getSubCategoryDetailsById = async (req, res, next) => {
  try {
    console.log(req.params.id, "id");
    const subCategoryId = req.params.subCategoryId;
    const subCategoryDetails = await Category.SubCategory.findById(
      subCategoryId
    );
    console.log(subCategoryDetails, "subCategorydetails");

    if (!subCategoryDetails) {
      return res.status(404).json({ error: "SubCategory not found" });
    }

    res.status(201).json({
      message: "successfully get SubCategory Details",
      data: subCategoryDetails,
    });
  } catch (error) {
    res.status(400).json({ message: "error fetching subCategory detail" });
  }
};

// Create nested subcategory
exports.createNestedSubCategory = async (req, res, next) => {
  try {
    const nestedSubCategoryData = new Category.SubCategoryNested(req.body);
    const createdNested = await nestedSubCategoryData.save();
    res.status(201).json({
      message: "Successfully created nested subcategory",
      data: createdNested,
    });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error creating nested subcategory", error });
  }
};

// Add nested subcategory to subcategory
exports.addNestedSubCategoryToSubCategory = async (req, res, next) => {
  try {
    const updatedSubCategory = await Category.SubCategory.findByIdAndUpdate(
      req.params.subCategoryId,
      { $push: { subCategories: req.body.nestedSubCategoryId } },
      { new: true }
    );

    res.status(201).json({
      message: "Successfully added nested subcategory to subcategory",
      data: updatedSubCategory,
    });
  } catch (error) {
    res.status(400).json({ message: "Error adding nested subcategory", error });
  }
};

// Update nested subcategory
exports.updateNestedSubCategory = async (req, res, next) => {
  try {
    const updatedNested = await Category.SubCategoryNested.findByIdAndUpdate(
      req.params.nestedSubCategoryId,
      req.body,
      { new: true }
    );

    res.status(201).json({
      message: "Successfully updated nested subcategory",
      data: updatedNested,
    });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error updating nested subcategory", error });
  }
};

// Delete nested subcategory
exports.deleteNestedSubCategory = async (req, res, next) => {
  try {
    const deletedNested = await Category.SubCategoryNested.deleteOne({
      _id: req.params.nestedSubCategoryId,
    });

    res.status(201).json({
      message: "Successfully deleted nested subcategory",
      data: deletedNested,
    });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error deleting nested subcategory", error });
  }
};

// Get all nested subcategories
exports.getAllNestedSubCategory = async (req, res, next) => {
  try {
    console.log("hiiiii");
    const data = await Category.SubCategoryNested.find();
    res.status(200).json({
      message: "Successfully fetched all nested subcategories",
      data: data,
    });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error fetching nested subcategories", error });
  }
};

// Get nested subcategory by ID
exports.getNestedSubCategoryDetailsById = async (req, res, next) => {
  try {
    const nested = await Category.SubCategoryNested.findById(
      req.params.nestedSubCategoryId
    );

    if (!nested) {
      return res.status(404).json({ message: "Nested subcategory not found" });
    }

    res.status(200).json({
      message: "Successfully fetched nested subcategory",
      data: nested,
    });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error fetching nested subcategory", error });
  }
};
