const express = require("express");
const {
  createOrder,
  deleteSpecificCartOrder,
  updateOrderedProduct,
  getOrderedProductList,
  getOrderDetails,
  getOrdersByUser,
  confirmOrdersBulk,
  getOutOfStockReport,
  sendOutOfStockReportEmail,
  checkOutOfStockProducts,
  bulkUpdateOutOfStock,
} = require("../controllers/orderController");
const {
  handlePaymentScreenshotUpload,
} = require("../handlers/multerPaymentScreenshot.handler");

const router = express.Router();

// Out-of-stock management
// Registered BEFORE the generic /order/:orderId routes: Express matches in
// declaration order, so a PATCH declared after "/order/:orderId" would be
// swallowed by that route with orderId === "out-of-stock".
router.get("/order/out-of-stock", getOutOfStockReport);
router.post("/order/out-of-stock/check", checkOutOfStockProducts);
router.post("/order/out-of-stock/email", sendOutOfStockReportEmail);
router.patch("/order/out-of-stock/bulk-stock", bulkUpdateOutOfStock);

router.post("/order/new/:userId", handlePaymentScreenshotUpload, createOrder);
router.get("/order", getOrderedProductList);
router.get('/order/user/:userId', getOrdersByUser);
router.get("/order/orderDetails/:productOrderId", getOrderDetails);
router.post('/order/confirm-bulk', confirmOrdersBulk);
router.patch("/order/:orderId", updateOrderedProduct);
router.delete("/order/:orderId", deleteSpecificCartOrder);

module.exports = router;
