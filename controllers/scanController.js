const Orders = require("../modals/orderModal");
const { Product } = require("../modals/product.modal");

// Mark order(s) as scanned and update sales - supports both single and bulk operations
const markOrderAsScanned = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Check if orderId is an array (bulk operation) or single value
    const isBulkOperation = Array.isArray(orderId);
    const orderIds = isBulkOperation ? orderId : [orderId];

    if (orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one Order ID is required"
      });
    }

    // Find all orders by productOrderId
    const orders = await Orders.find({ productOrderId: { $in: orderIds } })
      .populate('products.productId')
      .populate('userId');

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found"
      });
    }

    // Track results
    const results = {
      successful: [],
      alreadyScanned: [],
      failed: []
    };

    // Process each order
    for (const order of orders) {
      try {
        // Check if already scanned
        if (order.isScanned) {
          results.alreadyScanned.push({
            orderId: order.productOrderId,
            message: "Order already scanned"
          });
          continue;
        }

        // Update order as scanned
        order.isScanned = true;
        order.scannedAt = new Date();
        await order.save();

        // Update product stock quantities and sales data
        for (const item of order.products) {
          if (item.productId) {
            await Product.findByIdAndUpdate(
              item.productId._id,
              {
                $inc: {
                  stockQuantity: -item.quantity,
                  totalSales: item.totalAmount
                },
                $set: {
                  lastSoldAt: new Date()
                }
              }
            );
          }
        }

        results.successful.push({
          orderId: order.productOrderId,
          order: order
        });

      } catch (error) {
        console.error(`Error processing order ${order.productOrderId}:`, error);
        results.failed.push({
          orderId: order.productOrderId,
          error: error.message
        });
      }
    }

    // Check for orders that weren't found
    const foundOrderIds = orders.map(o => o.productOrderId);
    const notFoundIds = orderIds.filter(id => !foundOrderIds.includes(id));
    
    if (notFoundIds.length > 0) {
      notFoundIds.forEach(id => {
        results.failed.push({
          orderId: id,
          error: "Order not found"
        });
      });
    }

    // Determine response status and message
    const hasSuccessful = results.successful.length > 0;
    const hasFailures = results.failed.length > 0 || results.alreadyScanned.length > 0;

    let statusCode = 200;
    let message = "";

    if (hasSuccessful && !hasFailures) {
      message = isBulkOperation 
        ? `Successfully scanned ${results.successful.length} order(s)`
        : "Order successfully scanned and marked as sold";
    } else if (hasSuccessful && hasFailures) {
      statusCode = 207; // Multi-Status
      message = `Partially successful: ${results.successful.length} scanned, ${results.failed.length + results.alreadyScanned.length} failed`;
    } else {
      statusCode = 400;
      message = "No orders were successfully scanned";
    }

    res.status(statusCode).json({
      success: hasSuccessful,
      message: message,
      results: {
        successful: results.successful,
        alreadyScanned: results.alreadyScanned,
        failed: results.failed
      },
      summary: {
        total: orderIds.length,
        successful: results.successful.length,
        alreadyScanned: results.alreadyScanned.length,
        failed: results.failed.length
      }
    });

  } catch (error) {
    console.error("Scan error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get scanned orders for display
const getScannedOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const scannedOrders = await Orders.find({ isScanned: true })
      .populate('products.productId')
      .populate('userId')
      .sort({ scannedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Orders.countDocuments({ isScanned: true });

    res.status(200).json({
      success: true,
      orders: scannedOrders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalOrders: total
    });

  } catch (error) {
    console.error("Get scanned orders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get sales analytics data
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query; // daily, weekly, monthly, yearly

    let groupFormat;
    switch (period) {
      case 'daily':
        groupFormat = { year: { $year: "$scannedAt" }, month: { $month: "$scannedAt" }, day: { $dayOfMonth: "$scannedAt" } };
        break;
      case 'weekly':
        groupFormat = { year: { $year: "$scannedAt" }, week: { $week: "$scannedAt" } };
        break;
      case 'yearly':
        groupFormat = { year: { $year: "$scannedAt" } };
        break;
      default: // monthly
        groupFormat = { year: { $year: "$scannedAt" }, month: { $month: "$scannedAt" } };
    }

    const salesData = await Orders.aggregate([
      { $match: { isScanned: true } },
      {
        $group: {
          _id: groupFormat,
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          totalItems: { $sum: { $size: "$products" } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } }
    ]);

    // Get top selling products
    const topProducts = await Orders.aggregate([
      { $match: { isScanned: true } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: { $sum:  "$products.totalAmount"  }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      }
    ]);

    res.status(200).json({
      success: true,
      salesData: salesData,
      topProducts: topProducts,
      period: period
    });

  } catch (error) {
    console.error("Sales analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  markOrderAsScanned,
  getScannedOrders,
  getSalesAnalytics
};