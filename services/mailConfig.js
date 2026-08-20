require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  fromAddress: process.env.MAIL_SENDER_EMAIL,
};

const parseRecipients = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const EMAIL_CONFIG = {
  sender: SMTP_CONFIG.fromAddress,
  admin: process.env.ADMIN_EMAIL || SMTP_CONFIG.fromAddress,
  adminRecipients: parseRecipients(process.env.ADMIN_EMAIL || SMTP_CONFIG.fromAddress),
  domain: process.env.MAIL_DOMAIN || 'aabhushangallery.com',
};

const transporter = nodemailer.createTransport({
  host: SMTP_CONFIG.host,
  port: SMTP_CONFIG.port,
  secure: SMTP_CONFIG.secure,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5,
  auth: {
    user: SMTP_CONFIG.user,
    pass: SMTP_CONFIG.pass,
  },
  tls: {
    rejectUnauthorized: true,
  },
});

const buildCommonHeaders = ({ to, subject }) => {
  const timestamp = new Date().toISOString();
  const messageId = `<${Date.now()}-${Math.random().toString(36).slice(2)}@${EMAIL_CONFIG.domain}>`;

  return {
    messageId,
    date: timestamp,
    customHeaders: {
      'X-Mailer': 'AabhushanGallery-Mailer/1.0',
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'Importance': 'Normal',
      'List-Unsubscribe': `<mailto:${EMAIL_CONFIG.sender}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'Feedback-ID': `order-notification:${MESSAGE_ID_HASH}:${EMAIL_CONFIG.domain}`,
    },
  };
};

const MESSAGE_ID_HASH = process.env.MAIL_DOMAIN_HASH || 'abg001';

module.exports = {
  SMTP_CONFIG,
  EMAIL_CONFIG,
  transporter,
  buildCommonHeaders,
};
