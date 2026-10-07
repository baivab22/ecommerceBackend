/**
 * Verifies both invoice PDF paths (no email, no database needed):
 *
 *   1. Native (pdfkit) renderer — the Chromium-free fallback that guarantees a
 *      PDF attachment even on hosts with no Chrome binary. Its text must be
 *      real, readable PDF text: the required strings are decoded straight out
 *      of the content streams below.
 *   2. Chromium (puppeteer) renderer — the primary path.
 *
 * Run with: npm run verify:invoice-pdf
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {
  generateInvoicePdfBuffer,
  generateInvoiceNativePdfBuffer,
} = require('../services/invoiceRenderer.service');

const order = {
  _id: '64f000000000000000000001',
  productOrderId: 'ORD-TEST-1001',
  date: new Date(),
  name: 'Sita Sharma',
  shippingLocation: 'Kathmandu',
  locationAddress: 'Balaju, Block 3',
  phoneNumber: '+977 9841000000',
  paymentMethod: 'esewa',
  shippingPrice: 150,
  totalAmount: 4500,
  products: [
    { productId: { name: 'Gold Plated Marigold Ring' }, quantity: 2, price: 3000, colorName: 'Gold' },
    { productId: { name: 'Silver Zircon Necklace Set' }, quantity: 1, price: 1350, colorName: 'Silver' },
  ],
};

const params = {
  order,
  customerEmail: 'sita@example.com',
  customerName: 'Sita Sharma',
  senderEmail: 'support@aabhushangallery.com',
  title: 'Order Confirmation',
};

// Decompress every Flate stream in the PDF and turn the text-showing
// operators ([<hex> ...] TJ / (literal) Tj) back into readable characters.
const readText = (buf) => {
  const raw = buf.toString('latin1');
  const re = /stream\r?\n/g;
  const chunks = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end === -1) break;
    try {
      const stream = zlib.inflateSync(buf.slice(start, end)).toString('latin1');
      if (/TJ|Tj/.test(stream)) chunks.push(stream);
    } catch {
      /* not a Flate stream */
    }
    re.lastIndex = end;
  }

  return chunks
    .join('\n')
    .replace(/\[((?:<[0-9a-fA-F]+>|[-\d. ]+)+)\]\s*TJ|\((?:\\.|[^\\()])*\)\s*Tj/g, (whole, array) => {
      if (!array) return ' ';
      return [...array.matchAll(/<([0-9a-fA-F]+)>/g)]
        .map((hex) => Buffer.from(hex[1], 'hex').toString('latin1'))
        .join('');
    });
};

const REQUIRED_TEXT = [
  'INVOICE',
  'Abhushan Gallery',
  'Sita Sharma',
  'Gold Plated Marigold Ring',
  'NPR 4,500.00',
  'Amount in words',
  'NPR Four Thousand Five Hundred Only',
];

(async () => {
  const native = await generateInvoiceNativePdfBuffer(params);
  if (!native || native.length < 500) {
    console.error('FAIL: native PDF not generated', native && native.length);
    process.exit(1);
  }
  fs.writeFileSync(path.join(__dirname, 'output', 'verify-invoice-native.pdf'), native);

  const text = readText(native);
  const missing = REQUIRED_TEXT.filter((needle) => !text.includes(needle));
  if (missing.length) {
    console.error('FAIL: native PDF is missing text:', missing);
    process.exit(1);
  }
  console.log(`PASS: native PDF ${native.length} bytes, all required text present`);

  const chromium = await generateInvoicePdfBuffer(params);
  if (chromium && chromium.length) {
    console.log(`PASS: Chromium PDF ${chromium.length} bytes`);
  } else {
    console.log('NOTE: Chromium PDF unavailable — the native renderer above will be used');
  }
})();
