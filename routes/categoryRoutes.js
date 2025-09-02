const express = require("express");
const uploadCategoryImage = require("../handlers/multerCategory.handler");

const {
  createCategory,
  getAllCategory,
  getAllSubCategory,
  createSubCategory,
  updateCategory,
  addSubCategoryToCategory,
  updateSubCategory,
  deleteSubCategory,
  deleteCategory,
  getSubCategoryDetailsById,
  getCategoryDetailsById,
  createNestedSubCategory,
  addNestedSubCategoryToSubCategory,
  updateNestedSubCategory,
  deleteNestedSubCategory,
  getAllNestedSubCategory,
  getNestedSubCategoryDetailsById,
} = require("../controllers/categoryController");

const router = express.Router();

// Category routes with image upload
router.post(
  "/category/new",
  uploadCategoryImage.single("image"),
  createCategory
);
router.patch(
  "/category/:categoryId",
  uploadCategoryImage.single("image"),
  updateCategory
);
router.get("/category", getAllCategory);
router.get("/category/:categoryId", getCategoryDetailsById);
router.delete("/category/:categoryId", deleteCategory);

// SubCategory routes
router.post("/subCategory/new", createSubCategory);
router.post("/subCategory/:categoryId", addSubCategoryToCategory);
router.get("/subCategory", getAllSubCategory);
router.get("/subCategory/:subCategoryId", getSubCategoryDetailsById);
router.patch("/subCategory/:subCategoryId", updateSubCategory);
router.delete("/subCategory/:subCategoryId", deleteSubCategory);

// Nested SubCategory routes
router.post("/nestedSubCategory/new", createNestedSubCategory);
router.post(
  "/nestedSubCategory/:subCategoryId",
  addNestedSubCategoryToSubCategory
);
router.get("/nestedSubCategory", getAllNestedSubCategory);
router.get(
  "/nestedSubCategory/:nestedSubCategoryId",
  getNestedSubCategoryDetailsById
);
router.patch(
  "/nestedSubCategory/:nestedSubCategoryId",
  updateNestedSubCategory
);
router.delete(
  "/nestedSubCategory/:nestedSubCategoryId",
  deleteNestedSubCategory
);

module.exports = router;
