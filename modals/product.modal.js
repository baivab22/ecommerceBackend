const { File } = require("buffer");
const mongoose = require("mongoose");
const { SubCategory } = require("./category.modal");
const { Schema, Document, Types } = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  
  description: {
    type: String,
  },
  
  price: {
    type: Number,
  },
  
  stockQuantity: {
    type: Number,
    required: true,
  },
  
  isBestSelling: {
    type: Boolean,
    required: false,
  },
  
  isNewArrivals: {
    type: Boolean,
    required: false,
  },
  
  video: {
    type: String,
    required: false,
  },
  
  isWatchAndShop: {
    type: Boolean,
    required: false,
  },
  
  isHotSelling: { 
    type: Boolean, 
    required: true, 
    default: false 
  },
  
  originalPrice: {
    type: Number,
  },
  
  discountedPrice: {
    type: Number,
  },
  
  discountPercentage: {
    type: Number,
  },
  
  images: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "ProductImage" 
  }],
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
  
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
  },
  
  // NEW: Added nestedSubCategory field
  nestedSubCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategoryNested",
    required: false,
  },
});

const productImageSchema = new mongoose.Schema({
  colorName: String,
  coloredImage: {
    type: String,
    required: true,
  },
});

productSchema.set("toJSON", {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  },
});

const Product = mongoose.model("Product", productSchema);
const ProductImage = mongoose.model("ProductImage", productImageSchema);

module.exports = {
  Product,
  ProductImage,
};