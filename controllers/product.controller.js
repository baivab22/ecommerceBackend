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
      discountPercentage: req.body.discountPercentage,
      description: req.body.description,
      rating: req.body.rating,
      review: req.body.review,
      isNewArrivals: req.body.isNewArrivals,
      isBestSelling: req.body.isBestSelling,
      isWatchAndShop: req.body.isWatchAndShop,
      stockQuantity: req.body.stockQuantity,
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
    isNewArrivals,
    isBestSelling,
  } = req.query;
  try {
    console.log(isBestSelling, "isBest Selling");
    let query = {};
    // Search products by name if a search query is provided
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (isBestSelling) {
      query.isBestSelling = isBestSelling;
    }
    if (isNewArrivals) {
      console.log(isNewArrivals, "is New arrivals");
      query.isNewArrivals = isNewArrivals;
    }

    if (categoryId !== undefined && categoryId !== "") {
      query.category = categoryId;
    }

    if (subCategoryId !== undefined && subCategoryId !== "") {
      query.subCategory = subCategoryId;
    }
    if (minPrice && maxPrice) {
      console.log(minPrice, maxPrice, "minmax");
      query.discountedPrice = {
        $gte: parseInt(minPrice),
        $lte: parseInt(maxPrice),
      };
    } else if (minPrice) {
      query.discountedPrice = { $gte: parseInt(minPrice) };
    } else if (maxPrice) {
      query.discountedPrice = { $lte: parseInt(maxPrice) };
    }

    // Sort products by price if a sort query is provided
    let sortOption = {};
    if (order === "asc" && sort === "price") {
      sortOption.originalPrice = 1;
    } else if (order === "desc" && sort === "price") {
      sortOption.originalPrice = -1;
    } else if (order === "asc" && sort === "name") {
      sortOption.name = 1;
    } else if (order === "desc" && sort === "name") {
      sortOption.name = -1;
    }

    const products = await Product.find(query)
      .populate("category")
      .populate("subCategory")
      .populate("images")
      .sort(sortOption);

    res
      .status(200)
      .json({ message: "success fully get products", data: products });
    // console.log("all items find");
  } catch (err) {
    res.status(500).json({ error: "Error fetching products" });
  }
};

// exports.getAllProduct = async (req, res, next) => {
//   const data = await Product.find()
//     .populate("category")
//     .populate("subCategory");
//   res.status(200).json({ message: "success fully get products", data: data });
//   console.log("all items find");
// };

exports.deleteProduct = async (req, res, next) => {
  console.log("delete called");
  try {
    const deleteProductData = await Product.findByIdAndDelete(
      req.params.productId
    );
    // console.log(deleteProductData, "deleteproduct data");

    // Remove all images associated with the product
    // const imagesToDelete = deleteProductData.images.map((img) => img.filename); // Assuming `filename` holds the file name

    // imagesToDelete.forEach((filename) => {
    //   const filePath = path.join(__dirname, "../uploads/products", filename);
    //   fs.unlink(filePath, (err) => {
    //     if (err) {
    //       console.error(`Error deleting file ${filename}:`, err);
    //     }
    //   });
    // });

    res.status(200).json({
      message: "success fully deleted Product",
      data: deleteProductData,
    });
  } catch (error) {
    console.log("error", error);
  }
};

exports.deleteProductImages = async (req, res, next) => {
  console.log(req.params, "req.params");
  // const { productId, imroageId } = req.params;
  const { productId, imroageId } = req.params;

  try {
    // Find the product by ID

    const product = await Product.findOne({ _id: productId }).populate(
      "images"
    );

    console.log(product, "product");

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Find the image within the product's images array by its ID
    const imageIndex = product.images.findIndex((img) => img._id == imroageId);

    console.log(imageIndex, "imageIndex");

    if (imageIndex === -1) {
      return res.status(404).json({ error: "Image not found in the product" });
    }

    console.log(product.images, "product images values data");

    // Remove the image from the product's images array
    const deletedImage = product.images.splice(imageIndex, 1)[0];

    //  Remove all images associated with the product

    // Assuming `filename` holds the file name

    imagesToDelete.forEach((filename) => {
      const filePath = path.join(__dirname, "../uploads/products", filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filename}:`, err);
        }
      });
    });

    console.log(product.images, "product images guys");
    const imagesToDelete = product.images.map((img) => img.coloredImage);

    // Save the modified product to update the images array in the database
    await product.save();

    // Delete the image from Cloudinary using its public ID
    // await cloudinary.uploader.destroy(deletedImage._id);

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateProduct = async (req, res, next) => {
  // console.log(req.params.productId, "product id");
  // console.log(req.body, "req body");
  try {
    const urls = [];
    let videoUrl;

    // await Promise.all(
    //   req.files.image.map(async (item, index) => {
    //     const { path } = item;
    //     const newPath = await cloudinary.uploader.upload(
    //       path,
    //       { resource_type: "auto" } // Assuming you want to auto-detect resource type
    //     );

    //     urls.push({ url: newPath.secure_url });
    //   })
    // );

    // if (req.files.video) {
    //   const oldPath = await cloudinary.uploader.upload(
    //     req.files.video[0].path,
    //     // { public_id: "" },
    //     { resource_type: "auto" },
    //     function (error, result) {
    //       if (result) {
    //         videoUrl = result.secure_url;
    //       }
    //     }
    //   );
    // }

    // console.log(urls, videoUrl, "image and video url");

    console.log("product update", req.params.productId);

    const product = await Product.findOne({ _id: req.params.productId });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Append the new images to the existing ones
    // let newImages = product.image;

    // let updatedData = [...newImages, ...urls];

    // Save the updated product to the database
    // await product.save();

    const updatedProductData = await Product.findByIdAndUpdate(
      { _id: req.params.productId },
      {
        name: req.body.name,
        price: req.body.price,
        images: req.body.productVariants,
        video: req.files[0].filename,
        originalPrice: req.body.originalPrice,
        discountedPrice: req.body.discountedPrice,
        category: req.body.category,
        subCategory: req.body.subCategory,
        discountPercentage: req.body.discountPercentage,
        details: req.body.details,
        isNewArrivals: req.body.isNewArrivals,
        stockQuantity: req.body.stockQuantity,
        isBestSelling: req.body.isBestSelling,
      },
      {
        new: true,
      }
    );

    res.status(200).json({
      message: "success fully udpated Product",
      data: updatedProductData,
    });
  } catch (error) {
    console.log("error", error);
  }
};

exports.getProductDetailsById = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const productDetails = await Product.findById(productId)
      .populate("category")
      .populate("images")
      .populate("subCategory");

    if (!productDetails) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({
      message: "successfully get Product Details",
      data: productDetails,
    });
  } catch (error) {
    console.log(error, "error");
  }
};

exports.productListByCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    const productListByCategory = await Product.find({
      category: categoryId,
    });

    if (!productListByCategory) {
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
    // const ProductImages = new ProductImage(result);
    // Save the banner
    // const datas = await ProductImages.save();
    const savedImages = [];
    // const datas = await ProductImage.insertMany(result);

    for (const item of result) {
      const productImage = new ProductImage(item);
      const savedImage = await productImage.save(); // Save each document one by one
      savedImages.push(savedImage);
    }

    console.log(savedImages, "savedImages list");

    res.status(200).json({
      message: "successfully created productImage",
      data: savedImages,
    });
  } catch (error) {}
};

exports.deleteProductColorVariantImages = async (req, res, next) => {
  // const { productId, imroageId } = req.params;
  const { variantId, imageId } = req.params;

  console.log(variantId, imageId, "variantId, imageId");

  try {
    // Find the product by ID

    const productvariantImage = await ProductImage.findOne({ _id: variantId });

    if (!productvariantImage) {
      return res.status(404).json({ error: "Product color variant not found" });
    }

    // Find the image within the product's images array by its ID
    const imageIndex = productvariantImage.coloredImage.findIndex(
      (img) => img == imageId
    );

    if (imageIndex === -1) {
      return res
        .status(404)
        .json({ error: "Image variant not found in the product" });
    }

    // Remove the image from the product's images array
    const deletedImage = productvariantImage?.coloredImage.splice(
      imageIndex,
      1
    )[0];

    // Save the modified product to update the images array in the database
    await productvariantImage.save();

    // Delete the image from Cloudinary using its public ID
    // await cloudinary.uploader.destroy(deletedImage._id);

    res.json({ message: "variant Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllProductVariantImages = async (req, res, next) => {
  // const count = req.params.count;

  // myArray.slice(-3);
  const data = await ProductImage.find();

  const lastdata = data.slice(-req.params.count);
  res
    .status(200)
    .json({ message: "success fully get Product color Variant", data: data });
};
