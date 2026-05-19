// const express = require("express");
// const { productUpload, videoUpload } = require("../handlers/multerProduct.handler");

// const router = express.Router();

// const {
//   getAllProduct,
//   createProduct,
//   deleteProduct,
//   updateProduct,
//   getProductDetailsById,
//   productListByCategory,
//   deleteProductImages,
//   CreateProductImage,
//   deleteProductColorVariantImages,
//   getAllProductVariantImages,
// } = require("../controllers/product.controller");
// const productController = require("../controllers/product.controller");

// const cpUploadProductVideo = videoUpload.array("video", 12);
// const cpUploadProduct = productUpload.array("coloredImage", 12);

// router.route("/product").get(getAllProduct);
// router.route("/product/new").post(cpUploadProductVideo, createProduct);
// router.patch("/product/:productId", cpUploadProductVideo, updateProduct);
// router.delete("/product/:productId", deleteProduct);
// router.delete("/product/:productId/:imroageId", deleteProductImages);
// router.get("/product/:productId", getProductDetailsById);
// router.get("/product/category/:categoryId", productListByCategory);


// router.get('/products/hot-selling', productController.getHotSellingProducts);

// // Add product to hot selling
// // Protected route - only admin should be able to do this
// // If you have auth middleware, add it: router.post('/products/hot-selling', authenticate, isAdmin, productController.addToHotSelling);
// router.post('/products/hot-selling', productController.addToHotSelling);

// // Remove product from hot selling
// // Protected route - only admin should be able to do this
// // If you have auth middleware, add it: router.delete('/products/hot-selling/:productId', authenticate, isAdmin, productController.removeFromHotSelling);
// router.delete('/products/hot-selling/:productId', productController.removeFromHotSelling);

// // Bulk update hot selling status (optional)
// // Protected route - only admin should be able to do this
// router.patch('/products/hot-selling/bulk', productController.bulkUpdateHotSelling);

// router.route("/productImage/new").post(cpUploadProduct, CreateProductImage);

// router.delete(
//   "/productColor/:variantId/:imageId",
//   deleteProductColorVariantImages
// );

// router.route("/allColorVariant").get(getAllProductVariantImages);

// module.exports = router;

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// ✅ Setup storage directories
const uploadDirProducts = path.join(__dirname, "..", "uploads", "products");
if (!fs.existsSync(uploadDirProducts)) {
  fs.mkdirSync(uploadDirProducts, { recursive: true });
}

const uploadDirVideo = path.join(__dirname, "..", "uploads", "video");
if (!fs.existsSync(uploadDirVideo)) {
  fs.mkdirSync(uploadDirVideo, { recursive: true });
}

// Route video uploads to uploads/video and images to uploads/products
const storageMixed = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "video") {
      cb(null, uploadDirVideo);
    } else {
      cb(null, uploadDirProducts);
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const isAllowedImage = (mimetype) =>
  /^image\/(png|jpe?g|gif|webp|jfif|pjpeg|x-png)$/i.test(mimetype || "");

const isAllowedVideo = (mimetype) =>
  /^video\/(mp4|webm|quicktime|x-msvideo)$/i.test(mimetype || "");

// ✅ Create multer instances
const uploadProducts = multer({
  storage: storageMixed,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "video") {
      if (!isAllowedVideo(file.mimetype)) {
        return cb(
          new Error(`Video type not supported: ${file.mimetype || "unknown"}`),
          false
        );
      }
      return cb(null, true);
    }

    if (file.fieldname === "coloredImage") {
      if (!isAllowedImage(file.mimetype)) {
        return cb(
          new Error(`Image type not supported: ${file.mimetype || "unknown"}`),
          false
        );
      }
      return cb(null, true);
    }

    return cb(new Error(`Unexpected upload field: ${file.fieldname}`), false);
  },
});

const uploadVariant = multer({
  storage: storageMixed,
  fileFilter: (req, file, cb) => {
    if (!isAllowedImage(file.mimetype)) {
      return cb(
        new Error(`Image type not supported: ${file.mimetype || "unknown"}`),
        false
      );
    }
    return cb(null, true);
  },
});

// ✅ Configure field handlers for different endpoints
const cpUploadProductVideo = uploadProducts.fields([
  { name: "video", maxCount: 1 },
  { name: "coloredImage", maxCount: 50 },
]);

const cpUploadVariant = uploadVariant.fields([
  { name: "coloredImage", maxCount: 50 },
]);

const {
  getAllProduct,
  createProduct,
  deleteProduct,
  updateProduct,
  getProductDetailsById,
  productListByCategory,
  deleteProductImages,
  CreateProductImage,
  deleteProductColorVariantImages,
  getAllProductVariantImages,
  getHotSellingProducts,
  addToHotSelling,
  removeFromHotSelling,
  bulkUpdateHotSelling,
} = require("../controllers/product.controller");

// =====================================
// ROUTES
// =====================================

// Product CRUD
router.route("/product").get(getAllProduct);
router.route("/product/new").post(cpUploadProductVideo, createProduct);
router.patch("/product/:productId", cpUploadProductVideo, updateProduct);
router.delete("/product/:productId", deleteProduct);
router.get("/product/:productId", getProductDetailsById);
router.get("/product/category/:categoryId", productListByCategory);
router.delete("/product/:productId/:imroageId", deleteProductImages);

// Hot Selling Routes
router.get('/products/hot-selling', getHotSellingProducts);
router.post('/products/hot-selling', addToHotSelling);
router.delete('/products/hot-selling/:productId', removeFromHotSelling);
router.patch('/products/hot-selling/bulk', bulkUpdateHotSelling);

// Product Image Variants
router.route("/productImage/new").post(cpUploadVariant, CreateProductImage);
router.delete("/productColor/:variantId", deleteProductColorVariantImages);
router.route("/allColorVariant").get(getAllProductVariantImages);

module.exports = router;