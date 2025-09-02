const mongoose = require("mongoose");

// Schema for nested subcategories (leaf level)
const subCategoryNestedSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    index: true,
  },
});

// Schema for subcategories (can have nested subcategories)
const subCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    index: true,
  },
  subCategories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategoryNested",
    },
  ],
});

// Schema for top-level categories
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    index: true,
  },
  image: {
    type: String, // You can store image URL or path here
    default: null,
  },
  subCategories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },
  ],
});

// Add transformation to remove _id and replace with id
const transformId = (doc, ret) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
};

categorySchema.set("toJSON", { transform: transformId });
subCategorySchema.set("toJSON", { transform: transformId });
subCategoryNestedSchema.set("toJSON", { transform: transformId });

// Export models
exports.Category = mongoose.model("Category", categorySchema);
exports.SubCategory = mongoose.model("SubCategory", subCategorySchema);
exports.SubCategoryNested = mongoose.model(
  "SubCategoryNested",
  subCategoryNestedSchema
);
