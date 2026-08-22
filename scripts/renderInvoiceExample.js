/**
 * Example / test renderer for the Order Confirmation invoice PNG.
 *
 * Generates a PNG using the same data as the reference document so the output
 * can be visually compared against it:
 *
 *   node scripts/renderInvoiceExample.js
 *
 * Output: server/scripts/output/invoice-example.png (+ .html for debugging)
 */

const fs = require('fs');
const path = require('path');
const {
  buildInvoiceHtml,
  generateInvoicePngBuffer,
} = require('../services/invoiceRenderer.service');

// ─── REFERENCE EXAMPLE DATA ──────────────────────────────────────────────────
// Mirrors the reference Order Confirmation exactly.
const referenceInvoiceData = {
  invoiceNo: '65850',
  orderNo: '65850',
  date: 'May 25, 2026',
  currency: 'NPR',
  title: 'Order Confirmation',

  seller: {
    name: 'Abhushan Gallery',
    address: 'Kalimati, Kathmandu, Nepal',
    phone: '9861698400',
    email: 'baivabidari876@gmail.com',
  },

  customer: {
    name: 'Baivab Bidari',
    address:
      'kkkkkkk, Kalanki, Kuleshwar, Kathmandu-14, Kathmandu Metropolitan City, Kathmandu, Bagamati Province, 44614, Nepal',
    phone: '4343434343',
    email: 'bidaribaivab7@gmail.com',
  },

  items: [
    {
      name: 'Small Pearl And large Stone On Both Side',
      quantity: 1,
      unitPrice: 600,
      amount: 600,
    },
  ],

  subtotal: 600,
  shippingFee: 100,
  giftBoxCharge: 0,
  totalAmount: 700,
  totalItems: 1,
};

const OUT_DIR = path.join(__dirname, 'output');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Save HTML for debugging in a browser
  const html = buildInvoiceHtml(referenceInvoiceData);
  const htmlPath = path.join(OUT_DIR, 'invoice-example.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  // Render PNG (falls back to SVG attachment logic in production emails when
  // headless Chrome cannot run on the host — handled by emailServices.js)
  const png = await generateInvoicePngBuffer(referenceInvoiceData);
  if (!png) {
    console.error(
      'PNG generation failed (headless Chrome unavailable on this host). ' +
        'Emails will attach the vector SVG invoice instead.'
    );
    process.exit(1);
  }
  const pngPath = path.join(OUT_DIR, 'invoice-example.png');
  fs.writeFileSync(pngPath, png);

  console.log('HTML written to:', htmlPath);
  console.log('PNG written to :', pngPath);
  console.log('PNG size       :', `${png.length.toLocaleString()} bytes`);
})();
