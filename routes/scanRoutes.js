const express = require('express');
const router = express.Router();
const {
  markOrderAsScanned,
  getScannedOrders,
  getSalesAnalytics
} = require('../controllers/scanController');

// Mark order as scanned
router.post('/scan', markOrderAsScanned);

// Get scanned orders
router.get('/scanned-orders', getScannedOrders);

// Get sales analytics
router.get('/sales-analytics', getSalesAnalytics);

module.exports = router;