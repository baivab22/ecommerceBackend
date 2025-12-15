const emailMarketingService = require("../services/emailMarketingService");

/**
 * @desc    Send bulk email campaign to users
 * @route   POST /api/email/send-campaign
 * @access  Private/Admin
 */
exports.sendBulkEmailCampaign = async (req, res) => {
  try {
    const {
      subject,
      htmlContent,
      previewText,
      segment = 'all',
      testMode = false,
      testEmails = []
    } = req.body;

    console.log('📧 Received email campaign request:', {
      subject,
      segment,
      testMode,
      testEmailsCount: testEmails.length
    });

    // Validate required fields
    if (!subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Subject and HTML content are required'
      });
    }

    // Sanitize HTML content
    const sanitizedHtml = emailMarketingService.sanitizeHtml(htmlContent);

    // Prepare email data
    const emailData = {
      subject: subject.trim(),
      htmlContent: sanitizedHtml,
      previewText: previewText?.trim(),
      segment,
      testMode,
      testEmails: Array.isArray(testEmails) ? testEmails : []
    };

    // Send bulk email
    const results = await emailMarketingService.sendBulkEmail(emailData);

    // Log campaign results
    console.log('📧 Email campaign completed:', {
      total: results.total,
      sent: results.sent,
      failed: results.failed
    });

    res.status(200).json({
      success: true,
      message: `Email campaign completed successfully`,
      data: {
        total: results.total,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.slice(0, 10) // Return first 10 errors only
      }
    });

  } catch (error) {
    console.error('❌ Email campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email campaign',
      error: error.message
    });
  }
};

/**
 * @desc    Send test email to specific addresses
 * @route   POST /api/email/send-test
 * @access  Private/Admin
 */
exports.sendTestEmail = async (req, res) => {
  try {
    const {
      subject,
      htmlContent,
      previewText,
      testEmails
    } = req.body;

    console.log('🧪 Received test email request:', {
      subject,
      testEmailsCount: testEmails?.length
    });

    // Validate required fields
    if (!subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Subject and HTML content are required'
      });
    }

    if (!testEmails || !Array.isArray(testEmails) || testEmails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Test emails array is required with at least one email'
      });
    }

    // Validate email addresses
    const { validEmails, invalidEmails } = emailMarketingService.validateEmails(testEmails);
    
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some email addresses are invalid',
        data: {
          invalidEmails,
          validEmails
        }
      });
    }

    // Sanitize HTML content
    const sanitizedHtml = emailMarketingService.sanitizeHtml(htmlContent);

    const emailData = {
      subject: subject.trim(),
      htmlContent: sanitizedHtml,
      previewText: previewText?.trim(),
      testMode: true,
      testEmails: validEmails
    };

    const results = await emailMarketingService.sendBulkEmail(emailData);

    console.log('🧪 Test emails sent:', {
      sent: results.sent,
      failed: results.failed
    });

    res.status(200).json({
      success: true,
      message: `Test emails sent successfully`,
      data: {
        sent: results.sent,
        failed: results.failed,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test emails',
      error: error.message
    });
  }
};

/**
 * @desc    Get email statistics and user segments
 * @route   GET /api/email/statistics
 * @access  Private/Admin
 */
exports.getEmailStatistics = async (req, res) => {
  try {
    console.log('📊 Fetching email statistics');
    
    const stats = await emailMarketingService.getEmailStats();

    console.log('📊 Email statistics retrieved:', stats);

    res.status(200).json({
      success: true,
      message: 'Email statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('❌ Email statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email statistics',
      error: error.message
    });
  }
};

/**
 * @desc    Validate email addresses
 * @route   POST /api/email/validate-emails
 * @access  Private/Admin
 */
exports.validateEmailAddresses = async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        message: 'Emails array is required'
      });
    }

    const { validEmails, invalidEmails } = emailMarketingService.validateEmails(emails);

    res.status(200).json({
      success: true,
      message: 'Email validation completed',
      data: {
        validEmails,
        invalidEmails,
        total: emails.length,
        validCount: validEmails.length,
        invalidCount: invalidEmails.length
      }
    });

  } catch (error) {
    console.error('❌ Email validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate email addresses',
      error: error.message
    });
  }
};

/**
 * @desc    Get campaign history (placeholder - you can implement this with a database)
 * @route   GET /api/email/campaign-history
 * @access  Private/Admin
 */
exports.getCampaignHistory = async (req, res) => {
  try {
    // This would typically come from a database
    // For now, returning placeholder data
    const campaignHistory = [
      {
        id: 1,
        subject: "Summer Sale Campaign",
        segment: "all",
        sent: 1250,
        failed: 12,
        sentAt: new Date('2024-01-15'),
        status: 'completed'
      },
      {
        id: 2,
        subject: "New Collection Launch",
        segment: "active",
        sent: 890,
        failed: 5,
        sentAt: new Date('2024-01-10'),
        status: 'completed'
      }
    ];

    res.status(200).json({
      success: true,
      message: 'Campaign history retrieved',
      data: campaignHistory
    });

  } catch (error) {
    console.error('❌ Campaign history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get campaign history',
      error: error.message
    });
  }
};