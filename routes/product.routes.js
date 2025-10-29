const express = require("express");

const router = express.Router();
// const upload = require("../handlers/multer.handler");

const multer = require("multer");
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
} = require("../controllers/product.controller");

const productController = require("../controllers/product.controller");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/products");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const storageVideo = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/video");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const videoUpload = multer({ storage: storageVideo });
const cpUploadProductVideo = videoUpload.array("video", 12);
console.log(cpUploadProductVideo, "cpupload");
const upload = multer({ storage: storage });

const cpUploadProduct = upload.array("coloredImage", 12);

router.route("/product").get(getAllProduct);
router.route("/product/new").post(cpUploadProductVideo, createProduct);
router.patch("/product/:productId", cpUploadProductVideo, updateProduct);
router.delete("/product/:productId", deleteProduct);
router.delete("/product/:productId/:imroageId", deleteProductImages);
router.get("/product/:productId", getProductDetailsById);
router.get("/product/category/:categoryId", productListByCategory);


router.get('/products/hot-selling', productController.getHotSellingProducts);

// Add product to hot selling
// Protected route - only admin should be able to do this
// If you have auth middleware, add it: router.post('/products/hot-selling', authenticate, isAdmin, productController.addToHotSelling);
router.post('/products/hot-selling', productController.addToHotSelling);

// Remove product from hot selling
// Protected route - only admin should be able to do this
// If you have auth middleware, add it: router.delete('/products/hot-selling/:productId', authenticate, isAdmin, productController.removeFromHotSelling);
router.delete('/products/hot-selling/:productId', productController.removeFromHotSelling);

// Bulk update hot selling status (optional)
// Protected route - only admin should be able to do this
router.patch('/products/hot-selling/bulk', productController.bulkUpdateHotSelling);

router.route("/productImage/new").post(cpUploadProduct, CreateProductImage);

router.delete(
  "/productColor/:variantId/:imageId",
  deleteProductColorVariantImages
);

router.route("/allColorVariant").get(getAllProductVariantImages);

module.exports = router;
