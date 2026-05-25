const mongoose = require('mongoose');
const Orders = require("../modals/orderModal");
const { Product } = require("../modals/product.modal");
const {
  sendOutOfStockNotification,
  sendCompleteOutOfStockReport,
  sendNewOrderPlacedNotification,
  sendOrderConfirmationToCustomer,
  sendNcmPickupNotificationToCustomer,
} = require("../services/emailServices");
const { sendOrderDeliveryStatusChangedNotification } = require('../services/orderNotificationService');
const {
  createNcmOrder,
  parseNcmError,
  fetchNcmBranches,
  fetchNcmBranchDetails,
  fetchNcmShippingRate,
  fetchNcmOrderDetails,
  fetchNcmOrderComments,
  fetchNcmLastBulkComments,
  fetchNcmOrderStatus,
  fetchBulkNcmOrderStatuses,
  createNcmOrderComment,
  createVendorTicket,
  createVendorCodTransferTicket,
  closeVendorTicket,
  fetchVendorStaffs,
  markOrderReturn,
  createExchangeOrder,
  redirectOrder,
  upsertWebhookUrl,
  testWebhookUrl,
} = require('../services/ncmService');

const isTruthy = (value) => value === true || value === 'true' || value === 1 || value === '1';

const isOutsideValleyOrder = (order) => {
  const rawValue = order?.isInsideValley;
  if (rawValue === false) return true;

  const normalized = String(rawValue || '').trim().toLowerCase();
  return normalized === 'false' || normalized === '0';
};

const generateCompactOrderId = () => {
  // Deprecated: not used for new orders, but keep for legacy normalization
  return Math.floor(10000 + Math.random() * 90000).toString();
};

const normalizeProductOrderId = (incoming) => {
  const value = String(incoming || '').trim();
  // Accept only 5-digit numbers
  if (/^\d{5}$/.test(value)) {
    return value;
  }
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

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.statuses)) return value.statuses;
  if (Array.isArray(value.comments)) return value.comments;
  return [value];
};

const normalizeNcmStatuses = (rawStatuses) => {
  return toArray(rawStatuses)
    .map((item) => ({
      status: String(item?.status || item?.current_status || item?.order_status || item?.state || '').trim(),
      added_time: item?.added_time || item?.timestamp || item?.created_at || item?.updated_at || '',
      location: String(item?.location || item?.branch || item?.current_branch || '').trim(),
      raw: item,
    }))
    .filter((item) => item.status || item.added_time || item.location);
};

const normalizeNcmComments = (rawComments) => {
  return toArray(rawComments)
    .map((item) => ({
      comments: String(item?.comments || item?.comment || item?.message || item?.note || '').trim(),
      addedBy: String(item?.addedBy || item?.added_by || item?.author || item?.user || '').trim(),
      added_time: item?.added_time || item?.timestamp || item?.created_at || item?.updated_at || '',
      raw: item,
    }))
    .filter((item) => item.comments || item.addedBy || item.added_time);
};

const pickFirstString = (...values) => {
  for (const value of values) {
    const safe = String(value || '').trim();
    if (safe) return safe;
  }
  return '';
};

const normalizeStatusForCompare = (value) => String(value || '').trim().toLowerCase();

const NCM_EVENT_STATUS_MAP = {
  pickup_completed: 'Pickup Complete',
  sent_for_delivery: 'Sent for Delivery',
  order_dispatched: 'Dispatched',
  order_arrived: 'Arrived',
  delivery_completed: 'Delivered',
};

const deriveStatusFromEvent = (event) => {
  const key = String(event || '').trim().toLowerCase();
  return NCM_EVENT_STATUS_MAP[key] || '';
};

const buildStatusKey = (status) => {
  const safeStatus = String(status || '').trim().toLowerCase();
  return safeStatus;
};

const extractWebhookOrderId = (body) => {
  return pickFirstString(
    body?.orderid,
    body?.order_id,
    body?.orderId,
    body?.orderID,
    body?.ncmOrderId,
    body?.ncm_order_id,
    body?.vref_id,
    body?.vrefId,
    body?.vendor_ref,
    body?.vendor_ref_id,
    body?.reference_id,
    body?.id,
    body?.data?.orderid,
    body?.data?.order_id,
    body?.data?.orderId,
    body?.data?.orderID,
    body?.data?.ncmOrderId,
    body?.data?.ncm_order_id,
    body?.data?.vref_id,
    body?.data?.vrefId,
    body?.data?.vendor_ref,
    body?.data?.vendor_ref_id,
    body?.data?.reference_id,
    body?.payload?.orderid,
    body?.payload?.order_id,
    body?.payload?.orderId,
    body?.payload?.orderID,
    body?.payload?.ncmOrderId,
    body?.payload?.ncm_order_id,
    body?.payload?.vref_id,
    body?.payload?.vrefId,
    body?.payload?.vendor_ref,
    body?.payload?.vendor_ref_id,
    body?.payload?.reference_id
  );
};

const extractWebhookOrderIds = (body) => {
  const directIds = [
    body?.order_ids,
    body?.orderIds,
    body?.orderIDs,
    body?.data?.order_ids,
    body?.data?.orderIds,
    body?.data?.orderIDs,
    body?.payload?.order_ids,
    body?.payload?.orderIds,
    body?.payload?.orderIDs,
  ];

  const normalized = [];
  for (const candidate of directIds) {
    if (Array.isArray(candidate)) {
      for (const id of candidate) {
        const safe = String(id || '').trim();
        if (safe) normalized.push(safe);
      }
      continue;
    }

    if (typeof candidate === 'string') {
      const splitIds = candidate
        .split(',')
        .map((id) => String(id || '').trim())
        .filter(Boolean);
      normalized.push(...splitIds);
    }
  }

  const single = extractWebhookOrderId(body);
  if (single) normalized.push(single);

  return [...new Set(normalized)];
};

const extractWebhookStatus = (body) => {
  return pickFirstString(
    body?.status,
    body?.orderStatus,
    body?.order_status,
    body?.orderstatus,
    body?.current_status,
    body?.state,
    body?.data?.status,
    body?.data?.orderStatus,
    body?.data?.order_status,
    body?.data?.orderstatus,
    body?.data?.current_status,
    body?.payload?.status,
    body?.payload?.orderStatus,
    body?.payload?.order_status,
    body?.payload?.orderstatus,
    body?.payload?.current_status
  );
};

const extractWebhookComment = (body) => {
  return pickFirstString(
    body?.comments,
    body?.comment,
    body?.message,
    body?.note,
    body?.data?.comments,
    body?.data?.comment,
    body?.data?.message,
    body?.payload?.comments,
    body?.payload?.comment,
    body?.payload?.message
  );
};

const extractWebhookTimestamp = (body) => {
  const raw = pickFirstString(
    body?.timestamp,
    body?.added_time,
    body?.created_at,
    body?.updated_at,
    body?.data?.timestamp,
    body?.data?.added_time,
    body?.payload?.timestamp,
    body?.payload?.added_time
  );
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const buildTrackingSummary = (order, details, statuses, comments) => {
  const latestStatus = statuses[0] || null;
  const latestComment = comments[0] || null;
  const statusText = String(latestStatus?.status || order?.ncmLastStatus || '').trim();
  const statusLower = statusText.toLowerCase();

  return {
    ncmOrderId: order?.ncmOrderId || null,
    referenceId: order?.productOrderId || order?._id || null,
    syncStatus: order?.ncmSyncStatus || 'pending',
    pickupCreatedAt: order?.ncmPickupCreatedAt || null,
    destinationBranch: order?.ncmDestinationBranch || null,
    latestStatus: statusText || null,
    latestStatusTime: latestStatus?.added_time || order?.ncmLastStatusAt || null,
    latestStatusLocation: latestStatus?.location || null,
    latestComment: latestComment?.comments || order?.ncmLastComment || null,
    latestCommentTime: latestComment?.added_time || order?.ncmLastCommentAt || null,
    latestCommentBy: latestComment?.addedBy || null,
    lastWebhookEvent: order?.ncmLastWebhookEvent || null,
    lastWebhookAt: order?.ncmLastWebhookAt || null,
    statusCount: statuses.length,
    commentCount: comments.length,
    pickupCompleted: statusLower.includes('pickup completed') || statusLower.includes('picked up'),
    delivered: statusLower.includes('delivered'),
    detailsSnapshot: details && typeof details === 'object' ? details : null,
  };
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
      ncmSyncMeta: {
        success: false,
        skipped: false,
        ncmOrderId: null,
        error: 'Order not found',
      },
      isConfirmingNow: false,
    };
  }

  const confirmRequested = isTruthy(bodyData?.isConfirmed);
  const isConfirmingNow = confirmRequested && existing.isConfirmed !== true;




  const patchData = {
    ...bodyData,
  };

  if (isConfirmingNow && !patchData.confirmedAt) {
    patchData.confirmedAt = new Date();
  }

  let updatedOrder = await populateOrderDoc(
    Orders.findByIdAndUpdate(existing._id, patchData, { new: true })
  );

  let ncmSyncMeta = {
    success: false,
    skipped: false,
    ncmOrderId: null,
    error: null,
  };

  const shouldIntegrateNcm = isOutsideValleyOrder(updatedOrder);

  const shouldSkipNcm =
    updatedOrder &&
    !shouldIntegrateNcm &&
    (
      isConfirmingNow ||
      (updatedOrder.isConfirmed === true && !updatedOrder.ncmOrderId)
    );

  const shouldSyncNcm =
    updatedOrder &&
    shouldIntegrateNcm &&
    (
      isConfirmingNow ||
      (updatedOrder.isConfirmed === true && !updatedOrder.ncmOrderId)
    );
  if (shouldSkipNcm) {
    await Orders.findByIdAndUpdate(updatedOrder._id, {
      ncmSyncStatus: 'skipped',
      ncmSyncError: null,
    });

    ncmSyncMeta = {
      success: false,
      skipped: true,
      ncmOrderId: null,
      error: null,
      reason: 'not_outside_valley',
    };
  } else if (shouldSyncNcm) {
    if (updatedOrder.ncmOrderId) {
      await Orders.findByIdAndUpdate(updatedOrder._id, {
        ncmSyncStatus: 'skipped',
        ncmSyncError: null,
      });

      ncmSyncMeta = {
        success: true,
        skipped: true,
        ncmOrderId: updatedOrder.ncmOrderId,
        error: null,
      };
    } else {
      try {
        console.log('Creating NCM order for confirmed order', {
          orderId: String(updatedOrder?._id || ''),
          productOrderId: String(updatedOrder?.productOrderId || ''),
        });

        const ncmResult = await createNcmOrder(updatedOrder);
        console.log(ncmResult, 'ncm result value');
        updatedOrder = await populateOrderDoc(
          Orders.findByIdAndUpdate(
            updatedOrder._id,
            {
              ncmOrderId: ncmResult.ncmOrderId,
              ncmVendorRefId: updatedOrder.productOrderId || updatedOrder.ncmVendorRefId,
              ncmPickupCreatedAt: new Date(),
              ncmSyncStatus: 'success',
              ncmSyncError: null,
            },
            { new: true }
          )
        );

        ncmSyncMeta = {
          success: true,
          skipped: false,
          ncmOrderId: ncmResult.ncmOrderId,
          error: null,
        };
      } catch (ncmError) {
        const ncmErrorMessage = parseNcmError(ncmError);

        await Orders.findByIdAndUpdate(updatedOrder._id, {
          ncmSyncStatus: 'failed',
          ncmSyncError: ncmErrorMessage,
        });

        ncmSyncMeta = {
          success: false,
          skipped: false,
          ncmOrderId: null,
          error: ncmErrorMessage,
        };

        console.error('Failed to create NCM pickup order:', ncmErrorMessage);
      }
    }
  }

  if (isConfirmingNow && updatedOrder) {
    try {
      const customerConfirmationSent = await sendOrderConfirmationToCustomer(updatedOrder);
      if (!customerConfirmationSent) {
        console.error('Customer order confirmation email was not sent for order', updatedOrder?._id);
      }
    } catch (emailError) {
      console.error('Failed to send customer confirmation on admin confirm:', emailError);
    }

    // Send pickup notification only for outside-valley orders that created NCM records.
    try {
      if (shouldIntegrateNcm && ncmSyncMeta && ncmSyncMeta.success === true) {
        const ncmEmailSent = await sendNcmPickupNotificationToCustomer(updatedOrder, ncmSyncMeta);
        if (!ncmEmailSent) {
          console.error('Failed to send NCM pickup email to customer for order', updatedOrder?._id);
        }
      }
    } catch (ncmEmailError) {
      console.error('Error sending NCM pickup email to customer:', ncmEmailError);
    }
  }

  return {
    found: true,
    updatedOrder,
    ncmSyncMeta,
    isConfirmingNow,
  };
};

exports.createOrder = async (req, res) => {
  
        console.log(req.body, "create orders error");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //  console.log(error, "create orders error");

  
    // Generate a 5-digit numeric order ID
    const generateShortOrderId = () => {
      return Math.floor(10000 + Math.random() * 90000).toString();
    };



    const shortOrderId = generateShortOrderId();
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

    const newOrderData = new Orders({
      ...req.body,
      productOrderId: shortOrderId,
      ncmVendorRefId: shortOrderId,
      locationAddress: normalizedLocationAddress,
      shippingLocation: normalizedShippingLocation,
      phoneNumber: normalizedPhoneNumber,
    });

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
    const { updatedOrder, ncmSyncMeta } = await confirmOrderAndSync(req.params.orderId, req.body);

    res
      .status(201)
      .json({
        data: updatedOrder,
        message: "successfully updated Orders",
        ncm: ncmSyncMeta,
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
      const { found, updatedOrder, ncmSyncMeta } = await confirmOrderAndSync(orderId, {
        isConfirmed: true,
        confirmedAt: new Date(),
      });

      if (!found) {
        results.push({
          orderId,
          inputIdentifier: orderId,
          success: false,
          error: 'Order not found',
          ncm: ncmSyncMeta,
        });
        continue;
      }

      results.push({
        orderId: String(updatedOrder?._id || orderId),
        inputIdentifier: orderId,
        productOrderId: updatedOrder?.productOrderId || null,
        success: true,
        isConfirmed: updatedOrder?.isConfirmed === true,
        ncm: ncmSyncMeta,
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

exports.getNcmAssignedBranches = async (req, res) => {
  try {
    const branches = await fetchNcmBranches();
    return res.status(200).json({ branches });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM branches' });
  }
};

exports.getNcmOrderDetails = async (req, res) => {
  try {
    const orderId = req.query.orderId || req.params.orderId;
    const data = await fetchNcmOrderDetails(orderId);
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM order details' });
  }
};

exports.getNcmOrderComments = async (req, res) => {
  try {
    const orderId = req.query.orderId || req.params.orderId;
    const data = await fetchNcmOrderComments(orderId);
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM order comments' });
  }
};

exports.getNcmLastBulkComments = async (req, res) => {
  try {
    const data = await fetchNcmLastBulkComments();
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM comments' });
  }
};

exports.getNcmOrderStatus = async (req, res) => {
  try {
    const orderId = req.query.orderId || req.params.orderId;
    const data = await fetchNcmOrderStatus(orderId);


    console.log(data,"ncm order status data");
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM order status' });
  }
};

exports.createNcmComment = async (req, res) => {
  try {
    const data = await createNcmOrderComment(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create NCM comment' });
  }
};

exports.syncOrderToNcm = async (req, res) => {
  try {
    const order = await Orders.findById(req.params.orderId)
      .populate('userId')
      .populate({
        path: 'products.productId',
        model: 'Product',
        populate: {
          path: 'images',
          model: 'ProductImage',
        },
      });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.isConfirmed !== true) {
      return res.status(400).json({
        message: 'Order is not confirmed yet. Confirm order first before NCM sync.',
      });
    }

    if (order.ncmOrderId) {
      return res.status(200).json({
        success: true,
        skipped: true,
        ncmOrderId: order.ncmOrderId,
        message: 'Order already synced with NCM',
      });
    }

    // Only outside-valley orders should sync to NCM.
    if (!isOutsideValleyOrder(order)) {
      await Orders.findByIdAndUpdate(order._id, {
        ncmSyncStatus: 'skipped',
        ncmSyncError: null,
      });
      return res.status(200).json({
        success: true,
        skipped: true,
        ncmOrderId: null,
        message: 'Order is not marked as outside valley — NCM sync not required',
      });
    }

    const ncmResult = await createNcmOrder(order);

    await Orders.findByIdAndUpdate(order._id, {
      ncmOrderId: ncmResult.ncmOrderId,
      ncmVendorRefId: order.productOrderId || order.ncmVendorRefId,
      ncmPickupCreatedAt: new Date(),
      ncmSyncStatus: 'success',
      ncmSyncError: null,
    });

    return res.status(200).json({
      success: true,
      skipped: false,
      ncmOrderId: ncmResult.ncmOrderId,
      message: 'Order synced to NCM successfully',
    });
  } catch (error) {
    const ncmErrorMessage = parseNcmError(error);
    return res.status(500).json({ error: ncmErrorMessage });
  }
};

exports.getOrderTrackingDetails = async (req, res) => {
  try {
    const order = await Orders.findById(req.params.orderId)
      .populate({
        path: 'products.productId',
        model: 'Product',
        populate: {
          path: 'images',
          model: 'ProductImage',
        },
      })
      .populate({ path: 'userId', model: 'User' });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const responsePayload = {
      order,
      ncm: {
        details: null,
        statuses: [],
        comments: [],
        summary: null,
      },
    };

    if (order.ncmOrderId) {
      const [detailsResult, statusesResult, commentsResult] = await Promise.allSettled([
        fetchNcmOrderDetails(order.ncmOrderId),
        fetchNcmOrderStatus(order.ncmOrderId),
        fetchNcmOrderComments(order.ncmOrderId),
      ]);

      if (detailsResult.status === 'fulfilled') {
        responsePayload.ncm.details = detailsResult.value;
      }
      if (statusesResult.status === 'fulfilled') {
        responsePayload.ncm.statuses = normalizeNcmStatuses(statusesResult.value);
      }
      if (commentsResult.status === 'fulfilled') {
        responsePayload.ncm.comments = normalizeNcmComments(commentsResult.value);
      }
    }

    responsePayload.ncm.summary = buildTrackingSummary(
      order,
      responsePayload.ncm.details,
      responsePayload.ncm.statuses,
      responsePayload.ncm.comments
    );

    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch order tracking details' });
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

    const includeNcm = String(req.query.includeNcm || '').toLowerCase() === 'true';

    if (!includeNcm) {
      return res.status(200).json({ orders });
    }

    const ordersWithLiveStatus = await Promise.all(
      orders.map(async (order) => {
        const plain = typeof order.toObject === 'function' ? order.toObject() : order;
        if (!plain?.ncmOrderId) {
          return {
            ...plain,
            ncmLiveStatus: null,
          };
        }

        try {
          const statuses = await fetchNcmOrderStatus(plain.ncmOrderId);
          const normalizedStatuses = normalizeNcmStatuses(statuses);
          return {
            ...plain,
            ncmLiveStatus: normalizedStatuses.length ? normalizedStatuses[0] : null,
          };
        } catch (_error) {
          return {
            ...plain,
            ncmLiveStatus: null,
          };
        }
      })
    );

    return res.status(200).json({ orders: ordersWithLiveStatus });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user orders' });
  }
};

exports.getNcmShippingRate = async (req, res) => {
  try {
    const data = await fetchNcmShippingRate(req.query || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM shipping rate' });
  }
};

exports.getNcmBulkOrderStatuses = async (req, res) => {
  try {
    const data = await fetchBulkNcmOrderStatuses(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM bulk statuses' });
  }
};

exports.createNcmVendorTicket = async (req, res) => {
  try {
    const data = await createVendorTicket(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create NCM ticket' });
  }
};

exports.createNcmCodTransferTicket = async (req, res) => {
  try {
    const data = await createVendorCodTransferTicket(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create NCM COD ticket' });
  }
};

exports.closeNcmVendorTicket = async (req, res) => {
  try {
    const data = await closeVendorTicket(req.params.ticketId);
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to close NCM ticket' });
  }
};

exports.getNcmVendorStaffs = async (req, res) => {
  try {
    const data = await fetchVendorStaffs(req.query || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM staffs' });
  }
};

exports.markNcmOrderReturn = async (req, res) => {
  try {
    const data = await markOrderReturn(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to mark order return' });
  }
};

exports.createNcmExchangeOrder = async (req, res) => {
  try {
    const data = await createExchangeOrder(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create exchange order' });
  }
};

exports.redirectNcmOrder = async (req, res) => {
  try {
    const data = await redirectOrder(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to redirect order' });
  }
};

exports.upsertNcmWebhook = async (req, res) => {
  try {
    const data = await upsertWebhookUrl(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update webhook URL' });
  }
};

exports.testNcmWebhook = async (req, res) => {
  try {
    const data = await testWebhookUrl(req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to test webhook URL' });
  }
};

exports.receiveNcmWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const event = String(body.event || '').trim();
    const isTestWebhook = isTruthy(body?.test);
    if (isTestWebhook) {
      return res.status(200).json({ success: true, message: 'Test webhook received' });
    }

    const incomingOrderIds = extractWebhookOrderIds(body);
    const hasBulkOrderIds = incomingOrderIds.length > 1;

    if (!incomingOrderIds.length) {
      return res.status(400).json({ success: false, message: 'order id missing in webhook payload' });
    }

    const incomingStatus = extractWebhookStatus(body) || deriveStatusFromEvent(event);
    const incomingComment = extractWebhookComment(body);
    const incomingTime = extractWebhookTimestamp(body);

    const update = {
      ncmLastWebhookEvent: event || 'unknown',
      ncmLastWebhookAt: new Date(),
      ncmLastSyncAt: new Date(),
    };

    if (incomingStatus) {
      update.ncmLastStatus = incomingStatus;
      update.ncmLastStatusAt = incomingTime;
    }

    if (incomingComment) {
      update.ncmLastComment = incomingComment;
      update.ncmLastCommentAt = incomingTime;
    }

    const populateOrder = (query) => {
      return Orders.findOne(query)
        .populate('userId')
        .populate({
          path: 'products.productId',
          model: 'Product',
          populate: {
            path: 'images',
            model: 'ProductImage',
          },
        });
    };

    let matchedCount = 0;
    let notifiedCount = 0;

    for (const rawOrderId of incomingOrderIds) {
      const normalizedOrderId = String(rawOrderId || '').trim();
      if (!normalizedOrderId) continue;

      let existingOrder = await populateOrder({ ncmOrderId: normalizedOrderId });

      // Some NCM webhook payloads send only vendor/reference order ids.
      if (!existingOrder) {
        existingOrder = await populateOrder({
          $or: [
            { ncmVendorRefId: normalizedOrderId },
            { productOrderId: normalizedOrderId },
          ],
        });
      }

      if (!existingOrder) continue;

      matchedCount += 1;

      const previousStatus = String(existingOrder?.ncmLastStatus || '').trim();
      const previousNotifiedStatus = String(existingOrder?.ncmLastNotifiedStatus || '').trim();
      const existingStatusKeys = Array.isArray(existingOrder?.ncmNotifiedStatusKeys)
        ? existingOrder.ncmNotifiedStatusKeys.map((item) => String(item || '').split('::')[0]).filter(Boolean)
        : [];
      const seenStatusKeys = new Set(existingStatusKeys);

      const updatedOrder = await Orders.findByIdAndUpdate(
        existingOrder._id,
        update,
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

      const statusChanged = normalizeStatusForCompare(incomingStatus) !== normalizeStatusForCompare(previousStatus);
      const alreadyNotifiedForSameStatus =
        normalizeStatusForCompare(incomingStatus) === normalizeStatusForCompare(previousNotifiedStatus);
      const statusKey = buildStatusKey(incomingStatus);
      const isDuplicateStatusEvent = Boolean(incomingStatus) && seenStatusKeys.has(statusKey);

      if (incomingStatus && statusChanged && !alreadyNotifiedForSameStatus && !isDuplicateStatusEvent && updatedOrder) {
        try {
          await sendOrderDeliveryStatusChangedNotification(updatedOrder, {
            previousStatus,
            newStatus: incomingStatus,
            statusTime: update.ncmLastStatusAt || incomingTime || new Date(),
          });

          seenStatusKeys.add(statusKey);

          await Orders.findByIdAndUpdate(updatedOrder._id, {
            ncmLastNotifiedStatus: incomingStatus,
            ncmLastStatusNotifiedAt: update.ncmLastStatusAt || incomingTime || new Date(),
            ncmNotifiedStatusKeys: Array.from(seenStatusKeys).slice(-200),
          });

          notifiedCount += 1;
        } catch (notifyError) {
          console.error('Failed to send webhook status-change notification email:', notifyError?.message || notifyError);
        }
      }
    }

    if (!matchedCount) {
      return res.status(202).json({
        success: true,
        message: 'Webhook accepted but no matching local order found',
        totalOrderIds: incomingOrderIds.length,
      });
    }

    return res.status(200).json({
      success: true,
      message: hasBulkOrderIds ? 'Bulk webhook processed' : 'Webhook processed',
      matchedOrders: matchedCount,
      notificationSent: notifiedCount,
      totalOrderIds: incomingOrderIds.length,
      event: event || 'unknown',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Webhook processing failed' });
  }
};

exports.getNcmBranchDetails = async (req, res) => {
  try {
    const data = await fetchNcmBranchDetails();
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch NCM branch details' });
  }
};