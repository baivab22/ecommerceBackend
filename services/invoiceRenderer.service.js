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
      name: 'Abhushan Gallery',
      address: 'Kalimati, Kathmandu, Nepal',
      phone: '+977 9861698400',
      email: senderEmail || 'support@abhushangallery.com',
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

// ─── DATA NORMALIZATION ──────────────────────────────────────────────────────
// Accepts either extractInvoiceData() output or a raw InvoiceData object and
// guarantees every derived monetary value is computed, never trusted:
//   amount     = quantity × unitPrice          (per line)
//   subtotal   = Σ amount
//   totalAmount= subtotal + shipping + giftBox + other charges
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const normalizeInvoiceData = (raw) => {
  const data = { ...raw };
  data.currency = data.currency || 'NPR';
  data.title = data.title || 'Order Confirmation';

  const items = (Array.isArray(data.items) ? data.items : []).map((it) => {
    const quantity = Number(it?.quantity ?? 1) || 0;
    const unitPrice = round2(it?.unitPrice ?? 0);
    const amount =
      it?.amount !== undefined && it?.amount !== null && !isNaN(Number(it.amount))
        ? round2(it.amount)
        : round2(quantity * unitPrice);
    return { ...it, quantity, unitPrice, amount };
  });

  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
  const shippingFee = round2(data.shippingFee);
  const giftBoxCharge = round2(data.giftBoxCharge);
  const otherCharges = (Array.isArray(data.otherCharges) ? data.otherCharges : [])
    .map((c) => ({ label: String(c?.label ?? 'Charge'), amount: round2(c?.amount) }));

  const computedTotal = round2(
    subtotal +
      shippingFee +
      giftBoxCharge +
      otherCharges.reduce((s, c) => s + c.amount, 0)
  );
  // Trust an explicit totalAmount only if it is a valid number; otherwise compute.
  const explicitTotal = Number(data.totalAmount);

  return {
    ...data,
    items,
    subtotal,
    shippingFee,
    giftBoxCharge,
    otherCharges,
    totalAmount: !isNaN(explicitTotal) ? round2(explicitTotal) : computedTotal,
    totalItems: items.reduce((s, i) => s + i.quantity, 0),
  };
};

// ─── HTML TEMPLATE ───────────────────────────────────────────────────────────

const buildInvoiceHtml = (params) => {
  const data = normalizeInvoiceData(params?.invoiceNo ? params : extractInvoiceData(params));
  const logoDataUri = data._logoDataUri || getLogoDataUri();

  const itemRows = data.items.map((item, i) => `
    <tr>
      <td style="padding:14px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; width:8%; vertical-align:middle;">${i + 1}</td>
      <td style="padding:14px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; font-weight:500; width:42%; vertical-align:middle; word-break:break-word;">${escapeHtml(truncate(item.name, 50))}${item.color ? ` <span style="color:#667085;font-weight:400;">(${escapeHtml(item.color)})</span>` : ''}</td>
      <td style="padding:14px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; width:12%; text-align:center; vertical-align:middle;">${item.quantity}</td>
      <td style="padding:14px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; width:19%; text-align:right; vertical-align:middle;">${formatCurrency(item.unitPrice, data.currency)}</td>
      <td style="padding:14px 18px; border:1px solid #DDE2E7; font-size:18px; color:#344054; font-weight:600; width:19%; text-align:right; vertical-align:middle;">${formatCurrency(item.amount, data.currency)}</td>
    </tr>`).join('');

  const summaryRows = [
    { label: 'Subtotal', value: formatCurrency(data.subtotal, data.currency) },
    { label: 'Shipping Fee', value: formatCurrency(data.shippingFee, data.currency) },
    { label: 'Gift Box Charge', value: formatCurrency(data.giftBoxCharge, data.currency) },
    ...(data.otherCharges || []).map((c) => ({
      label: c.label,
      value: formatCurrency(c.amount, data.currency),
    })),
  ];

  const summaryHtml = summaryRows.map((r) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0;">
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
      /* Size by HEIGHT so the real brand mark fills the ~290px header box
         without distortion (logo aspect ratio ≈ 0.8). */
      height:288px;
      width:auto;
      max-width:230px;
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
      padding:24px 35px;
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
      padding:0 35px 24px;
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
      padding:0 35px 24px;
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
      padding:0 35px 26px;
      display:flex;
      justify-content:flex-end;
    }
    .totals-box{
      width:450px;
      border:1px solid #DDE2E7;
      border-radius:14px;
      padding:18px 22px;
      background:#F9FAFB;
    }
    .totals-divider{
      border:none;
      border-top:1px solid #DDE2E7;
      margin:8px 0;
    }
    .totals-total{
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:10px 0 0;
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
      padding:22px 35px 28px;
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
  if (!puppeteer) {
    return { browser: null, error: 'puppeteer is not installed' };
  }
  try {
    const browser = await puppeteer.launch({
      // NOTE: 'new' is deprecated/removed in recent puppeteer majors; boolean
      // true maps to the modern headless mode on every supported version.
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });
    return { browser, error: null };
  } catch (err) {
    return { browser: null, error: err.message };
  }
};

const generateInvoicePngBuffer = async (params) => {
  const data = normalizeInvoiceData(params?.invoiceNo ? params : extractInvoiceData(params));

  // INVOICE_FORCE_SHARP=1 skips Puppeteer entirely (used to exercise the
  // no-Chrome fallback path, e.g. to mirror shared-hosting behaviour locally).
  if (process.env.INVOICE_FORCE_SHARP === '1') {
    return generateInvoicePngWithSharp(data);
  }

  let browser;
  try {
    const launched = await _launchBrowser();
    if (!launched.browser) {
      // Surface WHY (missing system libs on shared hosting is the usual cause)
      // so production incidents are debuggable from logs alone.
      console.error(
        '[invoice] Browser launch failed — falling back to sharp SVG rasterizer:',
        launched.error
      );
      return generateInvoicePngWithSharp(data);
    }
    browser = launched.browser;
    const html = buildInvoiceHtml({ ...data, _logoDataUri: getLogoDataUri() });
    const page = await browser.newPage();
    await page.setViewport({ width: 1264, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    await page.waitForSelector('.page', { timeout: 5000 });

    const sheetEl = await page.$('.page');
    if (!sheetEl) {
      console.error('[invoice] .page element not found');
      return generateInvoicePngWithSharp(data);
    }
    const raw = await sheetEl.screenshot({ type: 'png' });
    return Buffer.from(raw);
  } catch (error) {
    console.error('[invoice] PNG generation failed — trying sharp fallback:', error.message);
    return generateInvoicePngWithSharp(data);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
};

// Renders the vector-SVG invoice to a real PNG via sharp/librsvg — no Chrome
// required, works on virtually any host. Output is 2× scale (2528px wide),
// matching the Puppeteer pipeline's deviceScaleFactor.
const generateInvoicePngWithSharp = async (dataOrParams) => {
  try {
    const sharp = require('sharp');
    const svgMarkup = buildInvoiceSvgMarkup(
      normalizeInvoiceData(dataOrParams?.invoiceNo || dataOrParams?.items ? dataOrParams : extractInvoiceData(dataOrParams))
    );
    return await sharp(Buffer.from(svgMarkup, 'utf8'), { density: 144 }) // 144/72 = 2×
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (error) {
    console.error('[invoice] sharp PNG rasterization failed:', error.message);
    return null;
  }
};

// ─── VECTOR SVG INVOICE (no-headless-Chromium fallback) ──────────────────────
// A pixel-accurate replica of the HTML invoice rendered as pure SVG — same
// layout coordinates as the Puppeteer template — so hosts without Chrome
// (typical cPanel/shared hosting) still get the exact reference design.
//
// TEXT IS RENDERED AS VECTOR PATHS using the bundled Liberation Sans TTFs, so
// output is identical on ANY host and never depends on system fonts installed
// (bare cPanel containers have none, which used to produce tofu boxes).
// Rasterized to PNG via sharp; also usable standalone when even sharp fails.

const FONT_DIR = path.join(__dirname, '../assets/fonts');
const _invoiceFontCache = {};

const _loadInvoiceFont = (weight) => {
  const key = weight >= 600 ? 'Bold' : 'Regular';
  if (_invoiceFontCache[key] !== undefined) return _invoiceFontCache[key];
  try {
    // Lazy require so missing opentype.js only degrades this fallback path.
    const opentype = require('opentype.js');
    const buf = fs.readFileSync(path.join(FONT_DIR, `LiberationSans-${key}.ttf`));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    _invoiceFontCache[key] = opentype.parse(ab);
  } catch (err) {
    console.error(`[invoice] Could not load bundled font (${key}):`, err.message);
    _invoiceFontCache[key] = null;
  }
  return _invoiceFontCache[key];
};

const _measureTextWidth = (text, size, weight = 400) => {
  const font = _loadInvoiceFont(weight);
  if (font) return font.getAdvanceWidth(String(text), size);
  return String(text).length * size * (weight >= 600 ? 0.56 : 0.52);
};

// Renders a text run as vector <path> data anchored at x,y baseline.
// Falls back to plain <text> only if the bundled font could not be loaded.
const svgText = ({ x, y, size, fill, text, weight = 400, anchor = 'start', spacing = 0 }) => {
  const content = String(text ?? '');
  const bold = weight >= 600;
  const font = _loadInvoiceFont(bold ? 700 : 400);
  if (!font) {
    const anchorAttr = anchor === 'start' ? '' : ` text-anchor="${anchor}"`;
    return `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="${fill}"${anchorAttr}>${escapeHtml(content)}</text>`;
  }
  const opts = spacing ? { tracking: Math.round((spacing / size) * 1000) } : undefined;
  const width = font.getAdvanceWidth(content, size, opts);
  let startX = x;
  if (anchor === 'end') startX = x - width;
  else if (anchor === 'middle') startX = x - width / 2;
  const p = font.getPath(content, startX, y, size, opts);
  return `<path d="${p.toPathData(2)}" fill="${fill}"/>`;
};

// Greedy word-wrap driven by real font metrics when available.
const wrapTextForSvg = (value, maxWidthPx, fontSize, weight = 400) => {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (_measureTextWidth(candidate, fontSize, weight) <= maxWidthPx) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      while (_measureTextWidth(line, fontSize, weight) > maxWidthPx && line.length > 8)
        line = line.slice(0, -2);
      if (line !== word) line += '…';
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6); // hard cap so pathological input cannot explode height
};

const buildInvoiceSvgMarkup = (data) => {
  const d = normalizeInvoiceData(data);
  const W = 1264;
  const PAD_X = 35;
  const CONTENT_W = W - PAD_X * 2; // 1194
  const items = d.items;

  // ── layout constants mirroring the verified HTML template ──
  const HEADER_H = 365;
  const SUM_TOP = HEADER_H + 1;
  const CARD_H = 78;
  const BILL_TOP = SUM_TOP + 24 + CARD_H + 24;
  const BILL_PAD = 24;
  const DETAIL_LH = 27;
  const CARD_INNER_W = 587 - 28 * 2;

  const billToFields = [
    { text: d.customer.name, bold: true },
    ...wrapTextForSvg(d.customer.address, CARD_INNER_W, 18).map((t) => ({ text: t })),
    { text: `Phone: ${d.customer.phone}` },
    { text: `Email: ${d.customer.email}` },
  ];
  const fromLines =
    wrapTextForSvg(d.seller.address, CARD_INNER_W, 18).length + 2; // phone + email
  const billCardH = Math.max(
    235,
    BILL_PAD * 2 + 25 + 16 + billToFields.length * DETAIL_LH
  );
  const fromCardH = Math.max(
    235,
    BILL_PAD * 2 + 25 + 16 + fromLines * DETAIL_LH
  );
  const CARD_H_MAX = Math.max(billCardH, fromCardH);

  const TABLE_TOP = BILL_TOP + CARD_H_MAX + 24;
  const COLS = [0.08, 0.42, 0.12, 0.19, 0.19].map((f) => f * CONTENT_W);
  const colX = [PAD_X];
  COLS.forEach((w) => colX.push(colX[colX.length - 1] + w));
  const HEAD_ROW_H = 49;
  const itemCellW = COLS[1] - 36;
  const rowHeights = items.map((it) =>
    Math.max(50, wrapTextForSvg(it.name, itemCellW, 18).length * DETAIL_LH + 23)
  );
  const TABLE_BOTTOM =
    TABLE_TOP + HEAD_ROW_H + rowHeights.reduce((s, h) => s + h, 0);

  const totalsRows = [
    { label: 'Subtotal', value: formatCurrency(d.subtotal, d.currency) },
    { label: 'Shipping Fee', value: formatCurrency(d.shippingFee, d.currency) },
    { label: 'Gift Box Charge', value: formatCurrency(d.giftBoxCharge, d.currency) },
    ...(d.otherCharges || []).map((c) => ({
      label: c.label,
      value: formatCurrency(c.amount, d.currency),
    })),
  ];
  const TOTALS_W = 450;
  const TOTALS_H = 36 + totalsRows.length * 36 + 17 + 40;
  const TOTALS_TOP = TABLE_BOTTOM + 24;
  const TOTALS_X = W - PAD_X - TOTALS_W;

  const FOOTER_TOP = TOTALS_TOP + TOTALS_H + 26;
  const DIVIDER_Y = FOOTER_TOP + 22;
  const H = DIVIDER_Y + 24 + 21 + 28;

  const p = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  p.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="#ffffff" stroke="#E4E7EC"/>`);

  // ── HEADER ──
  p.push(`<path d="M ${W} 20 A 20 20 0 0 0 ${W - 20} 0 L 20 0 A 20 20 0 0 0 0 20 L 0 ${HEADER_H} L ${W} ${HEADER_H} Z" fill="#F4F8FC"/>`);
  p.push(`<line x1="0" y1="${HEADER_H + 0.5}" x2="${W}" y2="${HEADER_H + 0.5}" stroke="#E0E4E8" stroke-width="1"/>`);

  const logoDataUri = data._logoDataUri || getLogoDataUri();
  if (logoDataUri) {
    p.push(`<image x="46" y="39" height="288" preserveAspectRatio="xMinYMid meet" xlink:href="${logoDataUri}"/>`);
  } else {
    p.push(svgText({ x: 46, y: 200, size: 32, fill: '#111827', text: d.seller.name, weight: 700 }));
  }
  p.push(svgText({ x: W - 45, y: 178, size: 44, fill: '#111827', text: d.title, weight: 700, anchor: 'end', spacing: -0.5 }));
  p.push(svgText({ x: W - 45, y: 218, size: 20, fill: '#475569', text: `Order #${d.orderNo}`, anchor: 'end' }));

  // ── SUMMARY CARDS ──
  const sumCards = [
    { label: 'INVOICE NO', value: String(d.invoiceNo) },
    { label: 'DATE', value: String(d.date) },
    { label: 'ITEMS', value: String(d.totalItems) },
  ];
  sumCards.forEach((c, i) => {
    const cx = PAD_X + i * (386 + 18);
    const cy = SUM_TOP + 24;
    p.push(`<rect x="${cx}" y="${cy}" width="386" height="${CARD_H}" rx="12" fill="#ffffff" stroke="#DDE2E7"/>`);
    p.push(svgText({ x: cx + 22, y: cy + 31, size: 16, fill: '#667085', text: c.label, spacing: 0.5 }));
    p.push(svgText({ x: cx + 22, y: cy + 52, size: 20, fill: '#172033', text: c.value, weight: 700 }));
  });

  // ── BILLING CARDS ──
  const drawBillingCard = (cx, title, fields) => {
    p.push(`<rect x="${cx}" y="${BILL_TOP}" width="587" height="${CARD_H_MAX}" rx="14" fill="#ffffff" stroke="#DDE2E7"/>`);
    p.push(svgText({ x: cx + 28, y: BILL_TOP + 44, size: 21, fill: '#101828', text: title, weight: 700 }));
    let by = BILL_TOP + 89;
    for (const f of fields) {
      p.push(svgText({ x: cx + 28, y: by, size: 18, fill: f.bold ? '#101828' : '#344054', text: f.text, weight: f.bold ? 700 : 400 }));
      by += DETAIL_LH;
    }
  };
  drawBillingCard(PAD_X, 'From', [
    ...wrapTextForSvg(d.seller.address, CARD_INNER_W, 18).map((t) => ({ text: t })),
    { text: `Phone: ${d.seller.phone}` },
    { text: `Email: ${d.seller.email}` },
  ]);
  drawBillingCard(PAD_X + 587 + 18, 'Bill To', billToFields);

  // ── ITEMS TABLE ──
  p.push(`<rect x="${colX[0]}" y="${TABLE_TOP}" width="${CONTENT_W}" height="${HEAD_ROW_H}" fill="#F4F8FC"/>`);
  const headers = ['#', 'Item', 'Qty', 'Unit Price', 'Amount'];
  headers.forEach((h, i) => {
    const baseY = TABLE_TOP + 30;
    if (i <= 1)
      p.push(svgText({ x: colX[i] + 18, y: baseY, size: 16, fill: '#344054', text: h, weight: 600 }));
    else if (i === 2)
      p.push(svgText({ x: (colX[i] + colX[i + 1]) / 2, y: baseY, size: 16, fill: '#344054', text: h, weight: 600, anchor: 'middle' }));
    else
      p.push(svgText({ x: colX[i + 1] - 18, y: baseY, size: 16, fill: '#344054', text: h, weight: 600, anchor: 'end' }));
  });

  let rowY = TABLE_TOP + HEAD_ROW_H;
  items.forEach((it, i) => {
    const rh = rowHeights[i];
    const baseY = rowY + 31;
    p.push(svgText({ x: colX[0] + 18, y: baseY, size: 18, fill: '#344054', text: i + 1 }));
    wrapTextForSvg(it.name, itemCellW, 18).forEach((line, li) =>
      p.push(svgText({ x: colX[1] + 18, y: baseY + li * DETAIL_LH, size: 18, fill: '#344054', text: line }))
    );
    p.push(svgText({ x: (colX[2] + colX[3]) / 2, y: baseY, size: 18, fill: '#344054', text: it.quantity, anchor: 'middle' }));
    p.push(svgText({ x: colX[4] - 18, y: baseY, size: 18, fill: '#344054', text: formatCurrency(it.unitPrice, d.currency), anchor: 'end' }));
    p.push(svgText({ x: colX[5] - 18, y: baseY, size: 18, fill: '#344054', text: formatCurrency(it.amount, d.currency), weight: 700, anchor: 'end' }));
    rowY += rh;
  });
  // grid lines
  for (let i = 0; i <= COLS.length; i++)
    p.push(`<line x1="${colX[i]}" y1="${TABLE_TOP}" x2="${colX[i]}" y2="${TABLE_BOTTOM}" stroke="#DDE2E7" stroke-width="1"/>`);
  p.push(`<rect x="${colX[0]}" y="${TABLE_TOP}" width="${CONTENT_W}" height="${HEAD_ROW_H + rowHeights.reduce((s, h) => s + h, 0)}" fill="none" stroke="#DDE2E7"/>`);
  let gy = TABLE_TOP + HEAD_ROW_H;
  rowHeights.forEach((rh) => {
    p.push(`<line x1="${colX[0]}" y1="${gy}" x2="${colX[0] + CONTENT_W}" y2="${gy}" stroke="#DDE2E7" stroke-width="1"/>`);
    gy += rh;
  });

  // ── TOTALS BOX ──
  p.push(`<rect x="${TOTALS_X}" y="${TOTALS_TOP}" width="${TOTALS_W}" height="${TOTALS_H}" rx="14" fill="#F9FAFB" stroke="#DDE2E7"/>`);
  let ty = TOTALS_TOP + 44;
  totalsRows.forEach((r) => {
    p.push(svgText({ x: TOTALS_X + 22, y: ty, size: 17, fill: '#667085', text: r.label }));
    p.push(svgText({ x: TOTALS_X + TOTALS_W - 22, y: ty, size: 17, fill: '#344054', text: r.value, anchor: 'end' }));
    ty += 36;
  });
  const dividerY = ty - 36 + 25;
  p.push(`<line x1="${TOTALS_X + 1}" y1="${dividerY}" x2="${TOTALS_X + TOTALS_W - 1}" y2="${dividerY}" stroke="#DDE2E7" stroke-width="1"/>`);
  const totalBase = dividerY + 42;
  p.push(svgText({ x: TOTALS_X + 22, y: totalBase, size: 20, fill: '#101828', text: 'Total', weight: 700 }));
  p.push(svgText({ x: TOTALS_X + TOTALS_W - 22, y: totalBase, size: 22, fill: '#111827', text: formatCurrency(d.totalAmount, d.currency), weight: 700, anchor: 'end' }));

  // ── FOOTER ──
  p.push(`<line x1="${PAD_X}" y1="${DIVIDER_Y}" x2="${W - PAD_X}" y2="${DIVIDER_Y}" stroke="#D0D5DD" stroke-width="2" stroke-dasharray="6 5"/>`);
  p.push(svgText({ x: W / 2, y: DIVIDER_Y + 37, size: 16, fill: '#667085', text: 'Thank you for your order. This is a system-generated document.', anchor: 'middle' }));

  p.push('</svg>');
  return p.join('\n');
};

const buildInvoiceSvg = (params) => {
  const data = normalizeInvoiceData(params?.invoiceNo ? params : extractInvoiceData(params));
  return buildInvoiceSvgMarkup(data);
};

const generateInvoiceSvgBuffer = (params) =>
  Buffer.from(buildInvoiceSvg(params), 'utf8');

const generateInvoicePngFromSvgBuffer = generateInvoicePngBuffer;

module.exports = {
  buildInvoiceHtml,
  buildInvoiceSvg,
  generateInvoicePngBuffer,
  generateInvoicePngWithSharp,
  generateInvoicePngFromSvgBuffer: generateInvoicePngWithSharp,
  generateInvoiceSvgBuffer,
  extractInvoiceData,
  normalizeInvoiceData,
  formatCurrency,
};
