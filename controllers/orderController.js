const mongoose = require('mongoose');
const Orders = require("../modals/orderModal");
const { Product } = require("../modals/product.modal");
const { sendOutOfStockNotification, sendCompleteOutOfStockReport } = require("../services/emailServices");

exports.createOrder = async (req, res) => {
  
        console.log(req.body, "create orders error");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //  console.log(error, "create orders error");

  
    const newOrderData = new Orders(req.body);

    const outOfStockProducts = [];

    // Update product stockQuantity based on the order
    for (const product of req.body.products) {
      const { productId, quantity } = product;
      console.log(product, quantity, "++++");
      
      const productData = await Product.findById(productId).session(session);

      if (!productData) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ error: `Product with ID ${productId} not found` });
      }

      if (productData.stockQuantity < quantity) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: `Not enough stock for product ${productId}` });
      }

      // Store previous stock quantity to check if product becomes out of stock
      const previousStock = productData.stockQuantity;
      
      productData.stockQuantity -= quantity;
      productData.totalSales += quantity;
      productData.lastSoldAt = new Date();
      
      await productData.save({ session });

      // Check if product becomes out of stock after this order
      if (previousStock > 0 && productData.stockQuantity === 0) {
        outOfStockProducts.push({
          ...productData.toObject(),
          previousStock,
          orderedQuantity: quantity
        });
      }
    }

    const createOrderedData = await newOrderData.save({ session });
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Send out-of-stock notifications for products that just became out of stock
    if (outOfStockProducts.length > 0) {
      try {
        await sendOutOfStockNotification(outOfStockProducts);
        
        // Mark that notification has been sent for these products
        for (const product of outOfStockProducts) {
          await Product.findByIdAndUpdate(product._id, { 
            outOfStockNotificationSent: true 
          });
        }
      } catch (emailError) {
        console.error('Failed to send out-of-stock notifications:', emailError);
      }
    }

    res.status(201).json({
      data: createOrderedData,
      success: "Successfully Created Orders",
    });
  } catch (error) {


    await session.abortTransaction();
    session.endSession();
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

    console.log(JSON.stringify(ordersList, null, 2), "values final order data");

    res
      .status(201)
      .json({ data: ordersList, success: "successfully Got Orders" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrderedProduct = async (req, res) => {


  console.log( req.params.orderId, req.body, "update order data");
  try {
    const updatedOrder = await Orders.findByIdAndUpdate(
      req.params.orderId,
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
    const deletedOrder = await Orders.findByIdAndRemove(req.params.id);
    res.json(deletedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { productOrderId } = req.params;

    console.log(productOrderId, req.params, "-----productOrderId----");

    const orderDetails = await Orders.findOne({ productOrderId: productOrderId })
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
        .json({ error: `Order with productOrderId ${productOrderId} not found` });
    }

    res.status(200).json({
      data: orderDetails,
      success: "Successfully retrieved order details",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Additional endpoint to manually check and send out-of-stock notifications
exports.checkOutOfStockProducts = async (req, res) => {
  try {
    const outOfStockProducts = await Product.find({ 
      stockQuantity: 0, 
      outOfStockNotificationSent: false 
    });

    let notificationsSent = 0;

    if (outOfStockProducts.length > 0) {
      // Convert to the format expected by sendOutOfStockNotification
      const newOutOfStockProducts = outOfStockProducts.map(product => ({
        ...product.toObject(),
        previousStock: product.stockQuantity + 1, // Estimate previous stock
        orderedQuantity: 1 // Default quantity
      }));

      const sent = await sendOutOfStockNotification(newOutOfStockProducts);
      if (sent) {
        for (const product of outOfStockProducts) {
          await Product.findByIdAndUpdate(product._id, { 
            outOfStockNotificationSent: true 
          });
        }
        notificationsSent = outOfStockProducts.length;
      }
    }

    res.status(200).json({
      message: `Out-of-stock check completed. ${notificationsSent} notifications sent.`,
      outOfStockProducts: outOfStockProducts.length,
      notificationsSent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New endpoint to get complete out-of-stock report
exports.getOutOfStockReport = async (req, res) => {
  try {
    const outOfStockProducts = await Product.find({ 
      stockQuantity: 0 
    })
    .populate('category')
    .populate('subCategory')
    .sort({ totalSales: -1, lastSoldAt: -1 });

    res.status(200).json({
      data: outOfStockProducts,
      total: outOfStockProducts.length,
      success: "Successfully retrieved out-of-stock report"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New endpoint to send complete out-of-stock report via email
exports.sendOutOfStockReportEmail = async (req, res) => {
  try {
    const sent = await sendCompleteOutOfStockReport();
    
    if (sent) {
      res.status(200).json({
        message: "Complete out-of-stock report sent successfully via email",
        success: true
      });
    } else {
      res.status(500).json({
        error: "Failed to send out-of-stock report email"
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};