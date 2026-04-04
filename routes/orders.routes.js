const express = require("express");
const {
  createOrder,
  deleteSpecificCartOrder,
  updateOrderedProduct,
  getOrderedProductList,
  getOrderDetails,
  sendInvoiceEmail
} = require("../controllers/orderController");

const router = express.Router();
router.post("/order/new/:userId", createOrder);
// Supports pagination, search, and filter via query params
router.get("/order", getOrderedProductList);
router.get("/order/orderDetails/:productOrderId", getOrderDetails);
router.patch("/order/:orderId", updateOrderedProduct);
router.delete("/order/:orderId", deleteSpecificCartOrder);
// router.post('/send-invoice', sendInvoiceEmail);

module.exports = router;
