const User = require("../modals/userModal");
const nodemailer = require("nodemailer");

// Email transporter (using your existing setup)
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "baivabbidari876@gmail.com",
    pass: "djuw xkgi vbpi vwqc",
  },
});

const emailMarketingService = {
  /**
   * Send bulk email to all users or specific segments
   */
  sendBulkEmail: async (emailData) => {
    try {
      const {
        subject,
        htmlContent,
        previewText,
        segment = 'all',
        testMode = false,
        testEmails = []
      } = emailData;

      // Validate required fields
      if (!subject || !htmlContent) {
        throw new Error('Subject and HTML content are required');
      }

      // Build query based on segment
      let userQuery = { 
        email: { $exists: true, $ne: null } 
      };

      switch (segment) {
        case 'active':
          userQuery.lastLoginAt = { 
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
          };
          break;
        case 'recent':
          userQuery.createdAt = { 
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
          };
          break;
        case 'all':
        default:
          break;
      }

      // Get users based on segment
      const users = testMode && testEmails.length > 0 
        ? testEmails.map(email => ({ email }))
        : await User.find(userQuery).select('email name').lean();

      if (!users || users.length === 0) {
        throw new Error('No users found for the selected segment');
      }

      const results = {
        total: users.length,
        sent: 0,
        failed: 0,
        errors: []
      };

      console.log(`📧 Starting bulk email send to ${users.length} users`);

      // Send emails in batches to avoid rate limiting
      const batchSize = 10;
      const delayBetweenBatches = 2000;

      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const batchPromises = batch.map(async (user) => {
          try {
            const mailOptions = {
              from: '"Aabhushan Gallery" <baivabbidari876@gmail.com>',
              to: user.email,
              subject: subject,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>${subject}</title>
                  <style>
                    body { 
                      font-family: 'Arial', sans-serif; 
                      line-height: 1.6; 
                      color: #333; 
                      margin: 0; 
                      padding: 0; 
                      background-color: #f4f4f4;
                    }
                    .container { 
                      max-width: 600px; 
                      margin: 0 auto; 
                      background: #ffffff; 
                    }
                    .header { 
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white; 
                      padding: 30px 20px; 
                      text-align: center; 
                    }
                    .brand { 
                      font-size: 28px; 
                      font-weight: bold; 
                      margin: 0; 
                    }
                    .tagline { 
                      font-size: 16px; 
                      margin: 10px 0 0 0; 
                      opacity: 0.9; 
                    }
                    .content { 
                      padding: 30px 20px; 
                    }
                    .footer { 
                      background: #f8f9fa; 
                      padding: 20px; 
                      text-align: center; 
                      color: #666; 
                      font-size: 12px; 
                      border-top: 1px solid #e9ecef;
                    }
                    .unsubscribe { 
                      margin-top: 15px; 
                      color: #999; 
                    }
                    .unsubscribe a { 
                      color: #666; 
                      text-decoration: none; 
                    }
                    img { 
                      max-width: 100%; 
                      height: auto; 
                    }
                    .button { 
                      display: inline-block; 
                      padding: 12px 30px; 
                      background: #667eea; 
                      color: white; 
                      text-decoration: none; 
                      border-radius: 5px; 
                      margin: 15px 0; 
                    }
                    @media only screen and (max-width: 600px) {
                      .container { 
                        width: 100% !important; 
                      }
                      .content { 
                        padding: 20px 15px; 
                      }
                      .header { 
                        padding: 20px 15px; 
                      }
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1 class="brand">AABHUSHAN GALLERY</h1>
                      <p class="tagline">Exquisite Jewelry Collection</p>
                    </div>
                    
                    <div class="content">
                      ${htmlContent}
                    </div>
                    
                    <div class="footer">
                      <p>&copy; ${new Date().getFullYear()} Aabhushan Gallery. All rights reserved.</p>
                      <p>Kalimati, Kathmandu, Nepal | 9861698400</p>
                      <div class="unsubscribe">
                        <a href="https://youwebsite.com/unsubscribe?email=${user.email}">Unsubscribe from marketing emails</a>
                      </div>
                    </div>
                  </div>
                </body>
                </html>
              `,
              text: previewText || subject
            };

            await transporter.sendMail(mailOptions);
            results.sent++;
            
            console.log(`✅ Email sent to: ${user.email}`);
            
          } catch (error) {
            results.failed++;
            results.errors.push({
              email: user.email,
              error: error.message
            });
            console.error(`❌ Failed to send to ${user.email}:`, error.message);
          }
        });

        await Promise.all(batchPromises);
        
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      console.log(`📧 Bulk email completed: ${results.sent} sent, ${results.failed} failed`);
      return results;

    } catch (error) {
      console.error('Bulk email error:', error);
      throw error;
    }
  },

  /**
   * Get email statistics and user segments
   */
  getEmailStats: async () => {
    try {
      const totalUsers = await User.countDocuments({ 
        email: { $exists: true, $ne: null } 
      });
      
      const activeUsers = await User.countDocuments({ 
        email: { $exists: true, $ne: null },
        lastLoginAt: { 
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
        } 
      });
      
      const recentUsers = await User.countDocuments({ 
        email: { $exists: true, $ne: null },
        createdAt: { 
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
        } 
      });

      return {
        totalUsers,
        activeUsers,
        recentUsers,
        segments: {
          all: totalUsers,
          active: activeUsers,
          recent: recentUsers
        }
      };
    } catch (error) {
      console.error('Error getting email stats:', error);
      throw error;
    }
  },

  /**
   * Validate email addresses
   */
  validateEmails: (emails) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = [];
    const invalidEmails = [];

    emails.forEach(email => {
      if (emailRegex.test(email)) {
        validEmails.push(email);
      } else {
        invalidEmails.push(email);
      }
    });

    return { validEmails, invalidEmails };
  },

  /**
   * Basic HTML sanitization
   */
  sanitizeHtml: (html) => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/on\w+='[^']*'/g, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');
  }
};

module.exports = emailMarketingService;