const express = require('express');
const router = express.Router();
const {
  markOrderAsScanned,
  getScannedOrders,
  getSalesAnalytics,
  removeSalesRecord
} = require('../controllers/scanController');

// Mark order as scanned
router.post('/scanned-orders', markOrderAsScanned);

// Get scanned orders
router.get('/scanned-orders', getScannedOrders);

// Get sales analytics
router.get('/sales-analytics', getSalesAnalytics);

// Remove order from scanned sales analytics
router.delete('/sales-analytics/:orderId', removeSalesRecord);

module.exports = router;