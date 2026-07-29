const nodemailer = require('nodemailer');

const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: 'planingdirectoratetu@gmail.com',
  pass: 'jjuu pqpt zfbh qxlm',
  fromAddress: 'planingdirectoratetu@gmail.com',
};

const parseRecipients = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const EMAIL_CONFIG = {
  sender: SMTP_CONFIG.fromAddress,
  admin: SMTP_CONFIG.fromAddress,
  adminRecipients: parseRecipients(SMTP_CONFIG.fromAddress),
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