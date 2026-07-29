const express = require("express");
const {
  createOrder,
  deleteSpecificCartOrder,
  updateOrderedProduct,
  getOrderedProductList,
  getOrderDetails,
  getOrdersByUser,
  confirmOrdersBulk,
} = require("../controllers/orderController");

const router = express.Router();
router.post("/order/new/:userId", createOrder);
router.get("/order", getOrderedProductList);
router.get('/order/user/:userId', getOrdersByUser);
router.get("/order/orderDetails/:productOrderId", getOrderDetails);
router.post('/order/confirm-bulk', confirmOrdersBulk);
router.patch("/order/:orderId", updateOrderedProduct);
router.delete("/order/:orderId", deleteSpecificCartOrder);

module.exports = router;
