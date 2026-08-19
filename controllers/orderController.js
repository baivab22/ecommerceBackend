const mongoose = require('mongoose');
const Orders = require("../modals/orderModal");
const { Product } = require("../modals/product.modal");
const {
  sendOutOfStockNotification,
  sendCompleteOutOfStockReport,
  sendNewOrderPlacedNotification,
  sendOrderConfirmationToCustomer,
  sendOrderPlacedConfirmationToCustomer,
} = require("../services/emailServices");

const isTruthy = (value) => value === true || value === 'true' || value === 1 || value === '1';

const generateCompactOrderId = () => {
  return `ord-${Date.now()}`;
};

const normalizeProductOrderId = (incoming) => {
  const value = String(incoming || '').trim();
  if (!value) return generateCompactOrderId();
  if (/^ord-\d+$/.test(value)) return value;
  if (/^\d{5}$/.test(value)) return `ord-${value}`;
  return generateCompactOrderId();
};

const normalizeOrderPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('977') && digits.length >= 13) {
    return digits.slice(-10);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
};

const isValidOrderPhone = (phone) => {
  const safe = String(phone || '');
  return /^9\d{9}$/.test(safe) || /^\d{7,10}$/.test(safe);
};

const orderPopulateConfig = [
  { path: 'userId' },
  {
    path: 'products.productId',
    model: 'Product',
    populate: {
      path: 'images',
      model: 'ProductImage',
    },
  },
];

const populateOrderDoc = (query) => {
  let chain = query;
  orderPopulateConfig.forEach((cfg) => {
    chain = chain.populate(cfg);
  });
  return chain;
};

const findOrderByIdentifier = async (identifier) => {
  const safe = String(identifier || '').trim();
  if (!safe) return null;
  if (mongoose.Types.ObjectId.isValid(safe)) {
    const byId = await Orders.findById(safe);
    if (byId) return byId;
  }
  return Orders.findOne({ productOrderId: safe });
};

const confirmOrderAndSync = async (orderIdentifier, bodyData) => {
  const existing = await findOrderByIdentifier(orderIdentifier);
  if (!existing) {
    return {
      found: false,
      updatedOrder: null,
      isConfirmingNow: false,
    };
  }

  const confirmRequested = isTruthy(bodyData?.isConfirmed);
  const isConfirmingNow = confirmRequested && existing.isConfirmed !== true;

  const patchData = { ...bodyData };

  if (isConfirmingNow && !patchData.confirmedAt) {
    patchData.confirmedAt = new Date();
  }

  const updatedOrder = await populateOrderDoc(
    Orders.findByIdAndUpdate(existing._id, patchData, { new: true })
  );

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

  return {
    found: true,
    updatedOrder,
    isConfirmingNow,
  };
};

exports.createOrder = async (req, res) => {
  
        console.log(req.body, "create orders error");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
  
    const generateUniqueOrderId = async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = `ord-${Date.now()}-${attempt}`;
        const exists = await Orders.findOne({ productOrderId: candidate }).lean();
        if (!exists) return candidate;
      }
      return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    };

    const productOrderId = req.body.productOrderId || await generateUniqueOrderId();
    const normalizedLocationAddress = String(req.body?.locationAddress || req.body?.shippingLocation || '').trim();
    const normalizedShippingLocation = String(req.body?.shippingLocation || req.body?.locationAddress || '').trim();
    const normalizedPhoneNumber = normalizeOrderPhone(req.body?.phoneNumber);

    if (!isValidOrderPhone(normalizedPhoneNumber)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        error: 'Invalid phone number. Please provide a valid phone number before placing order.',
      });
    }

    const outOfStockProducts = [];

    // Atomic stock decrement — prevents race conditions
    for (const product of req.body.products) {
      const { productId, quantity } = product;

      const result = await Product.findOneAndUpdate(
        { _id: productId, stockQuantity: { $gte: quantity } },
        {
          $inc: { stockQuantity: -quantity, totalSales: quantity },
          $set: { lastSoldAt: new Date() },
        },
        { session, new: true }
      );

      if (!result) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: `Not enough stock for product ${productId}` });
      }

      // Check if product became out of stock
      if (result.stockQuantity === 0) {
        outOfStockProducts.push({
          ...result.toObject(),
          previousStock: result.stockQuantity + quantity,
          orderedQuantity: quantity,
        });
      }
    }

    const newOrderData = new Orders({
      userId: req.body.userId,
      email: req.body.email,
      fullName: req.body.fullName,
      isGuestCheckout: req.body.isGuestCheckout,
      products: req.body.products,
      giftBoxCharge: req.body.giftBoxCharge,
      isRedZone: req.body.isRedZone,
      includeGiftBox: req.body.includeGiftBox,
      deliveryTimeMessage: req.body.deliveryTimeMessage,
      deliveryPartnerPrice: req.body.deliveryPartnerPrice,
      orderedBefore12PM: req.body.orderedBefore12PM,
      OrderedAt: req.body.OrderedAt,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      locationAddress: normalizedLocationAddress,
      isInsideValley: req.body.isInsideValley,
      productOrderId,
      shippingPrice: req.body.shippingPrice,
      totalAmount: req.body.totalAmount,
      phoneNumber: normalizedPhoneNumber,
      isHomeDelivery: req.body.isHomeDelivery,
      shippingLocation: normalizedShippingLocation,
      paymentMethod: req.body.paymentMethod,
      orderNote: req.body.orderNote,
      deliveryPartner: req.body.deliveryPartner,
    });

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

      console.log('Attempting to send admin notification email for order:', createOrderedData.productOrderId);
      const sent = await sendNewOrderPlacedNotification(enrichedOrderForEmail || createOrderedData);
      if (!sent) {
        console.error("Admin new-order email was NOT sent for order", createOrderedData?.productOrderId);
      } else {
        console.log('Admin notification email sent successfully for order:', createOrderedData.productOrderId);
      }
    } catch (adminEmailError) {
      console.error('Failed to send admin order notification email:', adminEmailError?.message || adminEmailError);
    }

    // Send order received confirmation email to customer with invoice (non-blocking).
    try {
      const enrichedOrderForCustomer = await Orders.findById(createOrderedData._id)
        .populate('userId')
        .populate('products.productId');

      const customerSent = await sendOrderPlacedConfirmationToCustomer(enrichedOrderForCustomer || createOrderedData);
      if (!customerSent) {
        console.error("Customer order placed confirmation email was not sent for order", createOrderedData?.productOrderId);
      } else {
        console.log('Customer order placed confirmation email sent for order:', createOrderedData.productOrderId);
      }
    } catch (customerEmailError) {
      console.error('Failed to send customer order placed confirmation email:', customerEmailError?.message || customerEmailError);
    }

    console.log(createOrderedData, "created order data");
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
    const existingOrder = await findOrderByIdentifier(req.params.orderId);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const { updatedOrder } = await confirmOrderAndSync(req.params.orderId, req.body);

    res
      .status(201)
      .json({
        data: updatedOrder,
        message: "successfully updated Orders",
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.confirmOrdersBulk = async (req, res) => {
  try {
    const rawOrderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];
    const normalizedOrderIds = [...new Set(
      rawOrderIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )];

    if (normalizedOrderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderIds is required and must be a non-empty array',
      });
    }

    const results = [];

    for (const orderId of normalizedOrderIds) {
      const { found, updatedOrder } = await confirmOrderAndSync(orderId, {
        isConfirmed: true,
        confirmedAt: new Date(),
      });

      if (!found) {
        results.push({
          orderId,
          inputIdentifier: orderId,
          success: false,
          error: 'Order not found',
        });
        continue;
      }

      results.push({
        orderId: String(updatedOrder?._id || orderId),
        inputIdentifier: orderId,
        productOrderId: updatedOrder?.productOrderId || null,
        success: true,
        isConfirmed: updatedOrder?.isConfirmed === true,
      });
    }

    const successCount = results.filter((item) => item.success).length;
    const failureCount = results.length - successCount;

    return res.status(failureCount > 0 ? 207 : 200).json({
      success: failureCount === 0,
      message: failureCount > 0
        ? `Partially confirmed: ${successCount} succeeded, ${failureCount} failed`
        : `Successfully confirmed ${successCount} order(s)`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Bulk confirmation failed' });
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const allOutOfStockProducts = await Product.find({
      stockQuantity: { $lte: 0 },
    })
      .populate('category')
      .populate('subCategory')
      .sort({ totalSales: -1, lastSoldAt: -1 });

    let filteredProducts = allOutOfStockProducts;
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedSearch, 'i');
      filteredProducts = allOutOfStockProducts.filter(
        (product) =>
          (product.name && regex.test(product.name)) ||
          (product.category?.name && regex.test(product.category.name)) ||
          (product.subCategory?.name && regex.test(product.subCategory.name))
      );
    }

    const total = filteredProducts.length;
    const paginatedProducts = filteredProducts.slice(skip, skip + limit);

    res.status(200).json({
      data: paginatedProducts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        total,
        highSales: allOutOfStockProducts.filter((p) => (p.totalSales || 0) >= 50).length,
        notificationPending: allOutOfStockProducts.filter((p) => !p.outOfStockNotificationSent).length,
      },
      success: "Successfully retrieved out-of-stock report",
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

exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Orders.find({ userId })
      .sort({ date: -1 })
      .populate({
        path: 'products.productId',
        model: 'Product',
        populate: {
          path: 'images',
          model: 'ProductImage',
        },
      })
      .populate({ path: 'userId', model: 'User' });

    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user orders' });
  }
};