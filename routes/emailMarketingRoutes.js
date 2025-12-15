const express = require('express');
const router = express.Router();
const emailMarketingController = require('../controllers/emailMarketingController');
// const { verifyToken } = require('../controllers/authController'); // Your existing auth middleware

/**
 * @route   POST /api/email/send-campaign
 * @desc    Send bulk email campaign to users
 * @access  Private/Admin
 */
router.post('/send-campaign', emailMarketingController.sendBulkEmailCampaign);

/**
 * @route   POST /api/email/send-test
 * @desc    Send test email to specific addresses
 * @access  Private/Admin
 */
router.post('/send-test', emailMarketingController.sendTestEmail);

/**
 * @route   GET /api/email/statistics
 * @desc    Get email statistics and user segments
 * @access  Private/Admin
 */
router.get('/statistics', emailMarketingController.getEmailStatistics);

/**
 * @route   POST /api/email/validate-emails
 * @desc    Validate email addresses
 * @access  Private/Admin
 */
router.post('/validate-emails', emailMarketingController.validateEmailAddresses);

/**
 * @route   GET /api/email/campaign-history
 * @desc    Get campaign history
 * @access  Private/Admin
 */
router.get('/campaign-history', emailMarketingController.getCampaignHistory);

module.exports = router;