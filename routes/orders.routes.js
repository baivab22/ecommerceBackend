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
} = require("../controllers/orderController");

const router = express.Router();
router.post("/order/new/:userId", createOrder);
router.get("/order", getOrderedProductList);
router.get('/order/user/:userId', getOrdersByUser);
router.get("/order/orderDetails/:productOrderId", getOrderDetails);
router.post('/order/confirm-bulk', confirmOrdersBulk);
router.patch("/order/:orderId", updateOrderedProduct);
router.delete("/order/:orderId", deleteSpecificCartOrder);

// Out-of-stock management
router.get("/order/out-of-stock", getOutOfStockReport);
router.post("/order/out-of-stock/check", checkOutOfStockProducts);
router.post("/order/out-of-stock/email", sendOutOfStockReportEmail);

module.exports = router;
