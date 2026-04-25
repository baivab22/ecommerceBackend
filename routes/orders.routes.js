const express = require("express");
const {
  createOrder,
  deleteSpecificCartOrder,
  updateOrderedProduct,
  getOrderedProductList,
  getOrderDetails,
  getOrderTrackingDetails,
  getOrdersByUser,
  getNcmAssignedBranches,
  getNcmBranchDetails,
  getNcmShippingRate,
  getNcmOrderDetails,
  getNcmOrderComments,
  getNcmLastBulkComments,
  getNcmOrderStatus,
  getNcmBulkOrderStatuses,
  createNcmComment,
  createNcmVendorTicket,
  createNcmCodTransferTicket,
  closeNcmVendorTicket,
  getNcmVendorStaffs,
  markNcmOrderReturn,
  createNcmExchangeOrder,
  redirectNcmOrder,
  upsertNcmWebhook,
  testNcmWebhook,
  receiveNcmWebhook,
  syncOrderToNcm,
  confirmOrdersBulk,
  sendInvoiceEmail
} = require("../controllers/orderController");

const router = express.Router();
router.post("/order/new/:userId", createOrder);
// Supports pagination, search, and filter via query params
router.get("/order", getOrderedProductList);
router.get('/order/user/:userId', getOrdersByUser);
router.get("/order/orderDetails/:productOrderId", getOrderDetails);
router.get('/order/:orderId/tracking', getOrderTrackingDetails);
router.get('/order/ncm/assigned-branches', getNcmAssignedBranches);
router.get('/order/ncm/branches', getNcmBranchDetails);
router.get('/order/ncm/shipping-rate', getNcmShippingRate);
router.get('/order/ncm/details', getNcmOrderDetails);
router.get('/order/ncm/comments', getNcmOrderComments);
router.get('/order/ncm/comments/latest', getNcmLastBulkComments);
router.get('/order/ncm/status', getNcmOrderStatus);
router.post('/order/ncm/statuses', getNcmBulkOrderStatuses);
router.post('/order/ncm/comment', createNcmComment);
router.post('/order/ncm/ticket', createNcmVendorTicket);
router.post('/order/ncm/ticket/cod', createNcmCodTransferTicket);
router.post('/order/ncm/ticket/close/:ticketId', closeNcmVendorTicket);
router.get('/order/ncm/staffs', getNcmVendorStaffs);
router.post('/order/ncm/return', markNcmOrderReturn);
router.post('/order/ncm/exchange', createNcmExchangeOrder);
router.post('/order/ncm/redirect', redirectNcmOrder);
router.post('/order/ncm/webhook', upsertNcmWebhook);
router.post('/order/ncm/webhook/test', testNcmWebhook);
router.post('/order/ncm/webhook/callback', receiveNcmWebhook);
router.post('/order/:orderId/ncm-sync', syncOrderToNcm);
router.post('/order/confirm-bulk', confirmOrdersBulk);
router.patch("/order/:orderId", updateOrderedProduct);
router.delete("/order/:orderId", deleteSpecificCartOrder);
// router.post('/send-invoice', sendInvoiceEmail);

module.exports = router;
