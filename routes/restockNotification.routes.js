const express = require("express");
const { authenticate } = require("../auth");
const {
  subscribe,
  unsubscribe,
} = require("../controllers/restockNotification.controller");

const router = express.Router();

// Authenticated — identity always comes from the JWT, never the request body.
router.post("/restock-notification/subscribe", authenticate, subscribe);
router.delete(
  "/restock-notification/subscribe/:productId",
  authenticate,
  unsubscribe
);

module.exports = router;
