const mongoose = require("mongoose");

/* ===============================
   Product Image Schema
================================ */
const productImageSchema = new mongoose.Schema(
  {
    colorName: {
      type: String,
      trim: true,
    },
    coloredImage: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ===============================
   Product Schema
================================ */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
    },

    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    isBestSelling: {
      type: Boolean,
      default: false,
    },

    isNewArrivals: {
      type: Boolean,
      default: false,
    },

    isWatchAndShop: {
      type: Boolean,
      default: false,
    },

    isHotSelling: {
      type: Boolean,
      default: false,
    },

    video: {
      type: String,
    },

    originalPrice: {
      type: Number,
    },

    discountedPrice: {
      type: Number,
    },

    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },

    images: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductImage",
      },
    ],

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },

    nestedSubCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategoryNested",
    },

    totalSales: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastSoldAt: {
      type: Date,
    },

    outOfStockNotificationSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // ✅ createdAt & updatedAt
    versionKey: false,
  }
);

/* ===============================
   JSON Transform
================================ */
productSchema.set("toJSON", {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  },
});

/* ===============================
   Models
================================ */
const Product = mongoose.model("Product", productSchema);
const ProductImage = mongoose.model("ProductImage", productImageSchema);

module.exports = {
  Product,
  ProductImage,
};
