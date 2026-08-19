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
};

const transporter = nodemailer.createTransport({
  host: SMTP_CONFIG.host,
  port: SMTP_CONFIG.port,
  secure: SMTP_CONFIG.secure,
  auth: {
    user: SMTP_CONFIG.user,
    pass: SMTP_CONFIG.pass,
  },
});

module.exports = {
  SMTP_CONFIG,
  EMAIL_CONFIG,
  transporter,
};