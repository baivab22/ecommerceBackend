// handlers/multerCategory.handler.js
const multer = require("multer");

const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/products");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const uploadCategoryImage = multer({ storage: categoryStorage });

module.exports = uploadCategoryImage;
