const { Product, ProductImage } = require("../modals/product.modal");
const fs = require("fs");
const path = require("path");

exports.createProduct = async (req, res, next) => {
  try {
    const urls = [];
    let videoUrl;

    const imagesfile = req.files.map((file) => file.filename);
    console.log(req.files, "coloredImage");
    
    const newProduct = new Product({
      name: req.body.name,
      price: req.body.price,
      stockQuantity: req.body.stockQuantity,
      images: req.body.productVariants,
      video: req.files[0].filename,
      originalPrice: req.body.originalPrice,
      discountedPrice: req.body.discountedPrice,
      category: req.body.category,
      subCategory: req.body.subCategory,
      nestedSubCategory: req.body.nestedSubCategory || null,
      discountPercentage: req.body.discountPercentage,
      description: req.body.description,
      rating: req.body.rating,
      review: req.body.review,
      isNewArrivals: req.body.isNewArrivals,
      isBestSelling: req.body.isBestSelling,
      isWatchAndShop: req.body.isWatchAndShop,
      isHotSelling: req.body.isHotSelling,
    });

    newProduct.save().then((prod) => {
      console.log(prod, "production");
      res.json(prod);
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};

exports.getAllProduct = async (req, res, next) => {
  const {
    search,
    sort,
    order,
    minPrice,
    maxPrice,
    categoryId,
    subCategoryId,
    nestedSubCategoryId,
    isNewArrivals,
    isBestSelling,
  } = req.query;
  
  try {
    let query = {};
    
    // Search products by name if a search query is provided
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (isBestSelling === 'true') {
      query.isBestSelling = true;
    }
    
    if (isNewArrivals === 'true') {
      query.isNewArrivals = true;
    }

    // Handle category filtering with hierarchical priority
    // Priority: nestedSubCategoryId (highest) > subCategoryId > categoryId (lowest)
    // Only filter by the most specific category level provided
    if (nestedSubCategoryId && nestedSubCategoryId.trim() !== "") {
      // Nested subcategory has highest priority - only filter by this
      query.nestedSubCategory = nestedSubCategoryId;
    } else if (subCategoryId && subCategoryId.trim() !== "") {
      // Subcategory has medium priority - only filter by this if no nested subcategory
      query.subCategory = subCategoryId;
    } else if (categoryId && categoryId.trim() !== "") {
      // Category has lowest priority - only filter by this if no subcategories provided
      query.category = categoryId;
    }

    // Price filtering
    if (minPrice || maxPrice) {
      query.discountedPrice = {};
      if (minPrice) {
        query.discountedPrice.$gte = parseInt(minPrice);
      }
      if (maxPrice) {
        query.discountedPrice.$lte = parseInt(maxPrice);
      }
    }

    // Sort products
    let sortOption = {};
    if (sort === "price") {
      sortOption.originalPrice = order === "asc" ? 1 : -1;
    } else if (sort === "name") {
      sortOption.name = order === "asc" ? 1 : -1;
    }

    const products = await Product.find(query)
      .populate("category")
      .populate("subCategory")
      .populate("nestedSubCategory")
      .populate("images")
      .sort(sortOption);

    res.status(200).json({ 
      message: "Successfully retrieved products", 
      data: products 
    });
    
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Error fetching products" });
  }
};

exports.deleteProduct = async (req, res, next) => {
  console.log("delete called");
  try {
    const deleteProductData = await Product.findByIdAndDelete(
      req.params.productId
    );

    res.status(200).json({
      message: "successfully deleted Product",
      data: deleteProductData,
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProductImages = async (req, res, next) => {
  console.log(req.params, "req.params");
  const { productId, imroageId } = req.params;

  try {
    const product = await Product.findOne({ _id: productId }).populate("images");

    console.log(product, "product");

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const imageIndex = product.images.findIndex((img) => img._id == imroageId);

    console.log(imageIndex, "imageIndex");

    if (imageIndex === -1) {
      return res.status(404).json({ error: "Image not found in the product" });
    }

    console.log(product.images, "product images values data");

    const deletedImage = product.images.splice(imageIndex, 1)[0];

    console.log(product.images, "product images guys");
    const imagesToDelete = product.images.map((img) => img.coloredImage);

    imagesToDelete.forEach((filename) => {
      const filePath = path.join(__dirname, "../uploads/products", filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filename}:`, err);
        }
      });
    });

    await product.save();

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const urls = [];
    let videoUrl;

    console.log("product update", req.params.productId);

    const product = await Product.findOne({ _id: req.params.productId });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updateData = {
      name: req.body.name,
      price: req.body.price,
      images: req.body.productVariants,
      video: req.files && req.files[0] ? req.files[0].filename : product.video,
      originalPrice: req.body.originalPrice,
      discountedPrice: req.body.discountedPrice,
      category: req.body.category,
      subCategory: req.body.subCategory,
      nestedSubCategory: req.body.nestedSubCategory || null,
      discountPercentage: req.body.discountPercentage,
      description: req.body.description,
      isNewArrivals: req.body.isNewArrivals,
      stockQuantity: req.body.stockQuantity,
      isBestSelling: req.body.isBestSelling,
      isHotSelling: req.body.isHotSelling,
      isWatchAndShop: req.body.isWatchAndShop,
    };

    const updatedProductData = await Product.findByIdAndUpdate(
      { _id: req.params.productId },
      updateData,
      { new: true }
    );

    res.status(200).json({
      message: "successfully updated Product",
      data: updatedProductData,
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getProductDetailsById = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const productDetails = await Product.findById(productId)
      .populate("category")
      .populate("images")
      .populate("subCategory")
      .populate("nestedSubCategory");

    if (!productDetails) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({
      message: "successfully get Product Details",
      data: productDetails,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({ error: error.message });
  }
};

exports.productListByCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    const productListByCategory = await Product.find({
      category: categoryId,
    })
    .populate("category")
    .populate("subCategory")
    .populate("nestedSubCategory")
    .populate("images");

    if (!productListByCategory || productListByCategory.length === 0) {
      return res
        .status(404)
        .json({ error: "Product not found for this category" });
    }

    res.status(200).json({
      message: "successfully get Products",
      data: productListByCategory,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({ error: error.message });
  }
};

exports.CreateProductImage = async (req, res, next) => {
  console.log("hellos", req.files);
  const remappedImages = req?.files?.map((file) => file.filename);

  console.log(remappedImages, req.body.colorName, "reqqqq");

  const result = remappedImages.map((image, index) => ({
    colorName: req.body.colorName[index],
    coloredImage: image,
  }));

  try {
    const savedImages = [];

    for (const item of result) {
      const productImage = new ProductImage(item);
      const savedImage = await productImage.save();
      savedImages.push(savedImage);
    }

    console.log(savedImages, "savedImages list");

    res.status(200).json({
      message: "successfully created productImage",
      data: savedImages,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProductColorVariantImages = async (req, res, next) => {
  const { variantId, imageId } = req.params;

  console.log(variantId, imageId, "variantId, imageId");

  try {
    const productvariantImage = await ProductImage.findOne({ _id: variantId });

    if (!productvariantImage) {
      return res.status(404).json({ error: "Product color variant not found" });
    }

    const imageIndex = productvariantImage.coloredImage.findIndex(
      (img) => img == imageId
    );

    if (imageIndex === -1) {
      return res
        .status(404)
        .json({ error: "Image variant not found in the product" });
    }

    const deletedImage = productvariantImage?.coloredImage.splice(
      imageIndex,
      1
    )[0];

    await productvariantImage.save();

    res.json({ message: "variant Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllProductVariantImages = async (req, res, next) => {
  try {
    const data = await ProductImage.find();

    res.status(200).json({ 
      message: "successfully get Product color Variant", 
      data: data 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};