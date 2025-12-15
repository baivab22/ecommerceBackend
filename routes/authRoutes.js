const express = require("express");
const userController = require("../controllers/userController");
const {
  sendInvoiceEmail
} = require("../controllers/userController");

const router = express.Router();
router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/google-login", userController.googleLogin);
router.post("/facebook-login", userController.facebookLogin);
router.post("/tiktok-login", userController.tiktokLogin); // NEW ROUTE
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);
router.post('/send-invoice', sendInvoiceEmail);

module.exports = router;