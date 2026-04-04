const mongoose = require('mongoose');
const Orders = require("../modals/orderModal");
const { Product } = require("../modals/product.modal");
const {
  sendOutOfStockNotification,
  sendCompleteOutOfStockReport,
  sendNewOrderPlacedNotification,
  sendOrderConfirmationToCustomer,
} = require("../services/emailServices");

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

    // Notify admin about every new order placement (non-blocking for order success).
    try {
      const enrichedOrderForEmail = await Orders.findById(createOrderedData._id)
        .populate('userId')
        .populate('products.productId');

      const sent = await sendNewOrderPlacedNotification(enrichedOrderForEmail || createOrderedData);
      if (!sent) {
        console.error("Admin new-order email was not sent for order", createOrderedData?._id);
      }
    } catch (adminEmailError) {
      console.error('Failed to send order notification emails:', adminEmailError);
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
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search ? req.query.search.trim() : '';

    // Date filtering
    const dateFilterType = req.query.dateFilter || 'all';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let dateQuery = {};
    const now = new Date();
    if (dateFilterType !== 'all') {
      let start, end;
      if (dateFilterType === 'last1hour') {
        start = new Date(now.getTime() - 60 * 60 * 1000);
        end = now;
      } else if (dateFilterType === 'last2hour') {
        start = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        end = now;
      } else if (dateFilterType === 'last1day') {
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        end = now;
      } else if (dateFilterType === 'last7days') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = now;
      } else if (dateFilterType === 'custom' && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        // Add 1 day to endDate to make it inclusive
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
      if (start && end) {
        dateQuery.date = { $gte: start, $lt: end };
      }
    }

    // Build search query
    let searchQuery = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      searchQuery = {
        $or: [
          { productOrderId: regex },
          { shippingLocation: regex },
          { locationAddress: regex },
          { paymentMethod: regex },
          { deliveryPartner: regex },
          { phoneNumber: regex },
        ]
      };
    }

    // Compose final query
    const query = {
      ...dateQuery,
      ...searchQuery,
    };

    // For searching inside user or products, need aggregation or populate+filter
    // For simplicity, fetch matching orders, then filter in-memory for user/product search

    // Get total count for pagination
    const totalCount = await Orders.countDocuments(query);

    // Fetch paginated orders
    let ordersList = await Orders.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
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
      });

    // If search includes user or product name, filter in-memory, then re-apply pagination
    let filteredOrders = ordersList;
    let filteredCount = totalCount;
    if (search) {
      const regex = new RegExp(search, 'i');
      filteredOrders = ordersList.filter(order => {
        // User fields
        if (order.userId) {
          if (order.userId.email && regex.test(order.userId.email)) return true;
          if (order.userId.name && regex.test(order.userId.name)) return true;
          if (order.userId.phone && regex.test(order.userId.phone)) return true;
        }
        // Product fields
        if (order.products && order.products.some(p => p.productId && p.productId.name && regex.test(p.productId.name))) return true;
        return (
          (order.productOrderId && regex.test(order.productOrderId)) ||
          (order.shippingLocation && regex.test(order.shippingLocation)) ||
          (order.locationAddress && regex.test(order.locationAddress)) ||
          (order.paymentMethod && regex.test(order.paymentMethod)) ||
          (order.deliveryPartner && regex.test(order.deliveryPartner)) ||
          (order.phoneNumber && regex.test(order.phoneNumber))
        );
      });
      filteredCount = filteredOrders.length;
      filteredOrders = filteredOrders.slice(0, limit); // Always return only the first page of filtered results
    }

    res.status(200).json({
      orders: search ? filteredOrders : ordersList,
      totalCount: search ? filteredCount : totalCount,
      page,
      limit,
      success: "successfully Got Orders"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrderedProduct = async (req, res) => {


  console.log( req.params.orderId, req.body, "update order data");
  try {
    const existingOrder = await Orders.findById(req.params.orderId);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isConfirmingNow =
      req.body?.isConfirmed === true && existingOrder.isConfirmed !== true;

    const patchData = {
      ...req.body,
    };

    if (isConfirmingNow && !patchData.confirmedAt) {
      patchData.confirmedAt = new Date();
    }

    const updatedOrder = await Orders.findByIdAndUpdate(
      req.params.orderId,
      patchData,
      { new: true }
    )
      .populate('userId')
      .populate({
        path: 'products.productId',
        model: 'Product',
        populate: {
          path: 'images',
          model: 'ProductImage',
        },
      });

    if (isConfirmingNow && updatedOrder) {
      try {
        const customerConfirmationSent = await sendOrderConfirmationToCustomer(updatedOrder);
        if (!customerConfirmationSent) {
          console.error('Customer order confirmation email was not sent for order', updatedOrder?._id);
        }
      } catch (emailError) {
        console.error('Failed to send customer confirmation on admin confirm:', emailError);
      }
    }

    res
      .status(201)
      .json({ data: updatedOrder, message: "successfully updated Orders" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSpecificCartOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId || req.params.id || req.params.userId;
    const deletedOrder = await Orders.findByIdAndDelete(orderId);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
      order: deletedOrder
    });
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