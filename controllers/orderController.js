const Orders = require("../modals/orderModal");
const { Product } = require("../modals/product.modal");

exports.createOrder = async (req, res) => {
  try {
    console.log(req.body, "create order");
    const newOrderData = new Orders(req.body);

    // Update product stockQuantity based on the order
    for (const product of req.body.products) {
      const { productId, quantity } = product;
      console.log(product, quantity, "++++");
      const productData = await Product.findById(productId);

      if (!productData) {
        return res
          .status(404)
          .json({ error: `Product with ID ${productId} not found` });
      }

      if (productData.stockQuantity < quantity) {
        return res
          .status(400)
          .json({ error: `Not enough stock for product ${productId}` });
      }

      productData.stockQuantity -= quantity;
      await productData.save();
    }

    const createOrderedData = await newOrderData.save();
    res.status(201).json({
      data: createOrderedData,
      success: "Successfully Created Orders",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderedProductList = async (req, res) => {
  try {
    const ordersList = await Orders.find()
      .populate({
        path: "products.productId",
        model: "Product",
      })
      .populate({
        path: "userId",
      });

    console.log(JSON.stringify(ordersList, null, 2), "values");

    res
      .status(201)
      .json({ data: ordersList, success: "successfully Got Orders" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrderedProduct = async (req, res) => {
  try {
    const updatedOrder = await Orders.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res
      .status(201)
      .json({ data: updatedOrder, message: "successfully updated Orders" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSpecificCartOrder = async (req, res) => {
  try {
    const deletedOrder = await OrderProduct.findByIdAndRemove(req.params.id);
    res.json(deletedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderDetails = await Orders.findById(orderId)
      .populate({
        path: "products.productId",
        model: "Product",
        populate: {
          path: "images",
          model: "ProductImage",
        },
      })
      .populate({
        path: "userId",
        model: "User",
      });

    if (!orderDetails) {
      return res
        .status(404)
        .json({ error: `Order with ID ${orderId} not found` });
    }

    res.status(200).json({
      data: orderDetails,
      success: "Successfully retrieved order details",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
