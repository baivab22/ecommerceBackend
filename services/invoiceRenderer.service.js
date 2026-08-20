const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../../client/public/assets/images/logosss.png');

const getLogoDataUri = () => {
  if (!fs.existsSync(LOGO_PATH)) return '';
  const buf = fs.readFileSync(LOGO_PATH);
  return `data:image/png;base64,${buf.toString('base64')}`;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const truncate = (str, max = 40) => {
  const s = String(str || '').trim();
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
};

const formatCurrency = (amount, currency = 'NPR') =>
  `${currency} ${Number(amount || 0).toLocaleString('en-NP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getPaymentMethodLabel = (method) => {
  const labels = {
    esewa: 'eSewa', khalti: 'Khalti', cod: 'Cash on Delivery',
    stripe: 'Stripe', bank: 'Bank Transfer', ime: 'IME Pay', npay: 'NPay',
  };
  return labels[String(method || '').toLowerCase()] || method || 'N/A';
};

// ─── DATA EXTRACTION ─────────────────────────────────────────────────────────

const extractInvoiceData = ({ order, customerEmail, customerName, senderEmail, title = 'Order Confirmation', currency = 'NPR' }) => {
  const orderId = order?.productOrderId || String(order?._id || '').slice(-8).toUpperCase();
  const orderDate = order?.OrderedAt ? new Date(order.OrderedAt) : new Date();

  const products = (order?.products || []).map((p) => {
    const qty = Number(p?.quantity || 1);
    const lineTotal = Number(p?.price || 0);
    const unitPrice = qty > 0 ? lineTotal / qty : lineTotal;
    return {
      name: p?.productId?.name || 'Product',
      color: p?.colorName || '',
      quantity: qty,
      unitPrice,
      amount: lineTotal,
    };
  });

  const subtotal = products.reduce((s, i) => s + i.amount, 0);
  const shippingFee = Number(order?.shippingPrice || 0);
  const giftBoxCharge = Number(order?.includeGiftBox ? 400 : order?.giftBoxCharge || 0);
  const totalAmount = Number(order?.totalAmount || subtotal + shippingFee + giftBoxCharge);

  return {
    invoiceNo: orderId,
    orderNo: orderId,
    date: formatDate(orderDate),
    currency,
    title,
    seller: {
      name: 'Aabhushan Gallery',
      address: 'Kalimati, Kathmandu, Nepal',
      phone: '+977 9861698400',
      email: senderEmail || 'support@aabhushangallery.com',
    },
    customer: {
      name: customerName || order?.fullName || 'Valued Customer',
      address: [order?.shippingLocation, order?.locationAddress].filter(Boolean).join(', ') || 'N/A',
      phone: order?.phoneNumber || 'N/A',
      email: customerEmail || order?.userId?.email || 'N/A',
    },
    items: products,
    shippingFee,
    giftBoxCharge,
    subtotal,
    totalAmount,
    totalItems: products.reduce((s, i) => s + i.quantity, 0),
  };
};

// ─── HTML TEMPLATE ───────────────────────────────────────────────────────────

const buildInvoiceHtml = (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  const logoDataUri = data._logoDataUri || getLogoDataUri();

  const itemRows = data.items.map((item, i) => `
    <tr>
      <td style="padding:16px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; width:8%; vertical-align:middle;">${i + 1}</td>
      <td style="padding:16px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; font-weight:500; width:42%; vertical-align:middle; word-break:break-word;">${escapeHtml(truncate(item.name, 50))}${item.color ? ` <span style="color:#667085;font-weight:400;">(${escapeHtml(item.color)})</span>` : ''}</td>
      <td style="padding:16px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; width:12%; text-align:center; vertical-align:middle;">${item.quantity}</td>
      <td style="padding:16px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; width:19%; text-align:right; vertical-align:middle;">${formatCurrency(item.unitPrice, data.currency)}</td>
      <td style="padding:16px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; font-weight:600; width:19%; text-align:right; vertical-align:middle;">${formatCurrency(item.amount, data.currency)}</td>
    </tr>`).join('');

  const summaryRows = [
    { label: 'Subtotal', value: formatCurrency(data.subtotal, data.currency) },
    { label: 'Shipping Fee', value: formatCurrency(data.shippingFee, data.currency) },
    { label: 'Gift Box Charge', value: formatCurrency(data.giftBoxCharge, data.currency) },
  ];

  const summaryHtml = summaryRows.map((r) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
      <span style="font-size:17px; color:#667085;">${r.label}</span>
      <span style="font-size:17px; color:#344054; font-weight:500;">${r.value}</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${data.title} - ${data.invoiceNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      background:#EEF2F6;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      color:#101828;
      padding:0;
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
    }
    .page{
      width:1264px;
      margin:0 auto;
      background:#ffffff;
      border-radius:20px;
      overflow:hidden;
      border:1px solid #E4E7EC;
      position:relative;
    }

    /* ── HEADER ── */
    .header{
      background:#F4F8FC;
      border-bottom:1px solid #E0E4E8;
      padding:0 45px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      min-height:365px;
    }
    .logo-col{
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      gap:0;
    }
    .logo-img{
      width:200px;
      height:auto;
      max-height:300px;
      object-fit:contain;
      display:block;
    }
    .header-right{
      text-align:right;
    }
    .header-right h1{
      font-size:44px;
      font-weight:700;
      color:#111827;
      letter-spacing:-0.5px;
      line-height:1.1;
      margin:0;
    }
    .header-right .order-num{
      font-size:20px;
      font-weight:400;
      color:#475569;
      margin-top:14px;
      letter-spacing:0;
    }

    /* ── SUMMARY CARDS ── */
    .summary-row{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:18px;
      padding:28px 35px;
    }
    .summary-card{
      border:1px solid #DDE2E7;
      border-radius:12px;
      padding:18px 22px;
      background:#ffffff;
      height:78px;
      display:flex;
      flex-direction:column;
      justify-content:center;
    }
    .summary-card .label{
      font-size:16px;
      font-weight:500;
      color:#667085;
      text-transform:uppercase;
      letter-spacing:0.5px;
      margin-bottom:4px;
    }
    .summary-card .value{
      font-size:20px;
      font-weight:700;
      color:#172033;
    }

    /* ── BILLING CARDS ── */
    .billing-row{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:18px;
      padding:0 35px 28px;
    }
    .billing-card{
      border:1px solid #DDE2E7;
      border-radius:14px;
      padding:24px 28px;
      background:#ffffff;
      min-height:235px;
    }
    .billing-card .card-title{
      font-size:21px;
      font-weight:700;
      color:#101828;
      margin-bottom:16px;
    }
    .billing-card .detail{
      font-size:18px;
      color:#344054;
      line-height:27px;
      margin:0;
    }
    .billing-card .detail strong{
      font-weight:600;
      color:#101828;
    }

    /* ── ITEMS TABLE ── */
    .table-wrap{
      padding:0 35px 28px;
    }
    .items-table{
      width:100%;
      border-collapse:collapse;
      border:1px solid #DDE2E7;
      border-radius:12px;
      overflow:hidden;
    }
    .items-table thead th{
      background:#F4F8FC;
      border:1px solid #DDE2E7;
      padding:15px 18px;
      font-size:16px;
      font-weight:600;
      color:#344054;
      text-align:left;
    }
    .items-table thead th.c{ text-align:center; }
    .items-table thead th.r{ text-align:right; }
    .items-table tbody td{
      border:1px solid #DDE2E7;
    }

    /* ── TOTALS ── */
    .totals-section{
      padding:0 35px 32px;
      display:flex;
      justify-content:flex-end;
    }
    .totals-box{
      width:450px;
      border:1px solid #DDE2E7;
      border-radius:14px;
      padding:22px 24px;
      background:#F9FAFB;
    }
    .totals-divider{
      border:none;
      border-top:1px solid #DDE2E7;
      margin:10px 0;
    }
    .totals-total{
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:12px 0 4px;
    }
    .totals-total .t-label{
      font-size:20px;
      font-weight:700;
      color:#101828;
    }
    .totals-total .t-value{
      font-size:22px;
      font-weight:800;
      color:#111827;
    }

    /* ── FOOTER ── */
    .footer{
      padding:24px 35px 32px;
      text-align:center;
    }
    .footer-divider{
      border:none;
      border-top:2px dashed #D0D5DD;
      margin-bottom:24px;
    }
    .footer p{
      font-size:16px;
      color:#667085;
      font-weight:400;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div class="logo-col">
        ${logoDataUri ? `<img src="${logoDataUri}" class="logo-img" alt="${escapeHtml(data.seller.name)}" />` : `<div style="font-size:32px;font-weight:700;color:#111827;">${escapeHtml(data.seller.name)}</div>`}
      </div>
      <div class="header-right">
        <h1>${escapeHtml(data.title)}</h1>
        <div class="order-num">Order #${escapeHtml(data.orderNo)}</div>
      </div>
    </div>

    <!-- SUMMARY CARDS -->
    <div class="summary-row">
      <div class="summary-card">
        <div class="label">Invoice No</div>
        <div class="value">${escapeHtml(data.invoiceNo)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Date</div>
        <div class="value">${escapeHtml(data.date)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Items</div>
        <div class="value">${data.totalItems}</div>
      </div>
    </div>

    <!-- BILLING CARDS -->
    <div class="billing-row">
      <div class="billing-card">
        <div class="card-title">From</div>
        <p class="detail">${escapeHtml(data.seller.name)}</p>
        <p class="detail">${escapeHtml(data.seller.address)}</p>
        <p class="detail">Phone: ${escapeHtml(data.seller.phone)}</p>
        <p class="detail">Email: ${escapeHtml(data.seller.email)}</p>
      </div>
      <div class="billing-card">
        <div class="card-title">Bill To</div>
        <p class="detail"><strong>${escapeHtml(data.customer.name)}</strong></p>
        <p class="detail">${escapeHtml(data.customer.address)}</p>
        <p class="detail">Phone: ${escapeHtml(data.customer.phone)}</p>
        <p class="detail">Email: ${escapeHtml(data.customer.email)}</p>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <div class="table-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:8%;">#</th>
            <th style="width:42%;">Item</th>
            <th class="c" style="width:12%;">Qty</th>
            <th class="r" style="width:19%;">Unit Price</th>
            <th class="r" style="width:19%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- TOTALS -->
    <div class="totals-section">
      <div class="totals-box">
        ${summaryHtml}
        <hr class="totals-divider"/>
        <div class="totals-total">
          <span class="t-label">Total</span>
          <span class="t-value">${formatCurrency(data.totalAmount, data.currency)}</span>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <hr class="footer-divider"/>
      <p>Thank you for your order. This is a system-generated document.</p>
    </div>

  </div>
</body>
</html>`;
};

// ─── PNG GENERATION ──────────────────────────────────────────────────────────

let _puppeteerCache = null;

const _loadPuppeteer = () => {
  if (_puppeteerCache !== null) return _puppeteerCache;
  try {
    _puppeteerCache = require('puppeteer');
    return _puppeteerCache;
  } catch (err) {
    console.error('[invoice] puppeteer not available:', err.message);
    _puppeteerCache = false;
    return false;
  }
};

const _launchBrowser = async () => {
  const puppeteer = _loadPuppeteer();
  if (!puppeteer) return null;
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--font-render-hinting=none',
    ],
  });
};

const generateInvoicePngBuffer = async (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  let browser;
  try {
    browser = await _launchBrowser();
    if (!browser) {
      console.error('[invoice] Could not launch browser for PNG generation');
      return null;
    }
    const html = buildInvoiceHtml({ ...data, _logoDataUri: getLogoDataUri() });
    const page = await browser.newPage();
    await page.setViewport({ width: 1264, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    await page.waitForSelector('.page', { timeout: 5000 });

    const sheetEl = await page.$('.page');
    if (!sheetEl) {
      console.error('[invoice] .page element not found');
      return null;
    }
    const raw = await sheetEl.screenshot({ type: 'png' });
    return Buffer.from(raw);
  } catch (error) {
    console.error('[invoice] PNG generation failed:', error.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
};

const generateInvoiceSvgBuffer = (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  const html = buildInvoiceHtml({ ...data, _logoDataUri: getLogoDataUri() });
  return Buffer.from(html, 'utf8');
};

// Keep old export names for backward compat with emailServices.js
const buildInvoiceSvg = (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  return buildInvoiceHtml({ ...data, _logoDataUri: getLogoDataUri() });
};

const generateInvoicePngFromSvgBuffer = generateInvoicePngBuffer;

module.exports = {
  buildInvoiceHtml,
  buildInvoiceSvg,
  generateInvoicePngBuffer,
  generateInvoicePngFromSvgBuffer,
  generateInvoiceSvgBuffer,
  extractInvoiceData,
  formatCurrency,
};
