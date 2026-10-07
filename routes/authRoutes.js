const express = require("express");
const userController = require("../controllers/userController");
const {
  sendInvoiceEmail
} = require("../controllers/userController");
const {describeSession} = require("../auth");

const router = express.Router();
router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/google-login", userController.googleLogin);
router.post("/facebook-login", userController.facebookLogin);
router.post("/tiktok-login", userController.tiktokLogin); // NEW ROUTE
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);
router.post('/send-invoice', sendInvoiceEmail);

// Lets the client confirm the session is genuinely valid instead of trusting
// that a token cookie exists. Not gated by authenticate — a 401 body here IS
// the answer the client is asking for.
router.get("/me", describeSession);

module.exports = router;