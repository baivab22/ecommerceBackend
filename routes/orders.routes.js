const express = require("express");
const {
  createOrder,
  deleteSpecificCartOrder,
  updateOrderedProduct,
  getOrderedProductList,
  getOrderDetails,
} = require("../controllers/orderController");

const router = express.Router();
router.post("/order/new/:userId", createOrder);
router.get("/order", getOrderedProductList);
router.get("/order/orderDetails/:orderId", getOrderDetails);
router.patch("/order/:userId", updateOrderedProduct);
router.delete("/order/:userId", deleteSpecificCartOrder);

module.exports = router;
