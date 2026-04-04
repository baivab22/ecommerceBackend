const nodemailer = require('nodemailer');

const parseRecipients = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const EMAIL_CONFIG = {
  sender: process.env.MAIL_SENDER_EMAIL || process.env.SMTP_USER,
  admin: process.env.ADMIN_EMAIL,
  adminRecipients: parseRecipients(process.env.ADMIN_EMAIL),
};

if (
  !EMAIL_CONFIG.sender ||
  !process.env.SMTP_USER ||
  !process.env.SMTP_PASS ||
  EMAIL_CONFIG.adminRecipients.length === 0
) {
  throw new Error(
    'Missing email configuration. Set MAIL_SENDER_EMAIL, SMTP_USER, SMTP_PASS, and ADMIN_EMAIL in server/.env'
  );
}

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

module.exports = {
  EMAIL_CONFIG,
  transporter,
};