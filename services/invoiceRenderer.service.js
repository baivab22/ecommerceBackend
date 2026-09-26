const { getLogoDataUri } = require('./logoAsset.service');

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

/**
 * Resolves the date an order was placed on.
 *
 * `OrderedAt` is a String the client fills with `toLocaleString()`, so its
 * format follows the *customer's* browser locale. V8 only parses the en-US
 * shape ("9/26/2026, 10:41:23 AM"); day-first variants ("26/09/2026,
 * 15:53:02") throw an Invalid Date and the invoice then printed "N/A".
 * Roughly 9% of real orders were affected.
 *
 * Order of preference:
 *   1. `date`       — a real BSON Date with `default: Date.now`, so it is both
 *                     unambiguous and present on every order.
 *   2. `OrderedAt`  — parsed leniently, honouring a day-first string when the
 *                     native parser rejects it.
 *   3. now         — last resort, never blank.
 */
const resolveOrderDate = (order) => {
  if (order?.date) {
    const fromDateField = order.date instanceof Date ? order.date : new Date(order.date);
    if (!isNaN(fromDateField.getTime())) return fromDateField;
  }

  const raw = order?.OrderedAt;
  if (raw) {
    const direct = raw instanceof Date ? raw : new Date(raw);
    if (!isNaN(direct.getTime())) return direct;

    // Native parsing gave up — retry as an explicit DD/MM/YYYY, HH:mm:ss.
    const text = String(raw).trim();
    const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      const [, d, m, y, hh, mm, ss] = match;
      const parsed = new Date(
        Number(y), Number(m) - 1, Number(d),
        Number(hh || 0), Number(mm || 0), Number(ss || 0)
      );
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  return new Date();
};

const getPaymentMethodLabel = (method) => {
  const labels = {
    esewa: 'eSewa', khalti: 'Khalti', cod: 'Cash on Delivery',
    stripe: 'Stripe', bank: 'Bank Transfer', ime: 'IME Pay', npay: 'NPay',
  };
  return labels[String(method || '').toLowerCase()] || method || 'N/A';
};

// ─── AMOUNT IN WORDS ─────────────────────────────────────────────────────────

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigitsToWords = (n) => {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
};

const threeDigitsToWords = (n) => {
  const parts = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n > 0) parts.push(twoDigitsToWords(n));
  return parts.join(' ');
};

const numberToWords = (num) => {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero';
  const groups = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const scales = ['Thousand', 'Million', 'Billion'];
  const words = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    if (i === 0) words.push(threeDigitsToWords(groups[i]));
    else words.push(`${threeDigitsToWords(groups[i])} ${scales[i - 1]}`);
  }
  return words.join(' ');
};

const formatAmountInWords = (amount, currency = 'NPR') => {
  const value = Number(amount || 0);
  if (!isFinite(value)) return '';
  const rupees = Math.floor(value);
  const paisa = Math.round((value - rupees) * 100);
  let text = `${currency} ${numberToWords(rupees)} Only`;
  if (paisa > 0) text += ` and ${twoDigitsToWords(paisa)} Paisa`;
  return text;
};

// ─── DATA EXTRACTION ─────────────────────────────────────────────────────────

const extractInvoiceData = ({ order, customerEmail, customerName, senderEmail, title = 'Order Confirmation', currency = 'NPR' }) => {
  const orderId = order?.productOrderId || String(order?._id || '').slice(-8).toUpperCase();
  const orderDate = resolveOrderDate(order);

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
    paymentMethod: getPaymentMethodLabel(order?.paymentMethod),
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

// ─── A4 HTML TEMPLATE ────────────────────────────────────────────────────────
// Exact A4 geometry (210mm x 297mm). Content longer than one page flows onto
// continuation pages automatically when printed to PDF — nothing is truncated.

const buildInvoiceHtml = (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  const logoDataUri = data._logoDataUri || getLogoDataUri();
  // Pinning the footer with position:absolute makes Chromium treat .page as a
  // single unfragmentable box, so it may only be used for single-page content
  // (see generateInvoicePdfBuffer's two-pass sizing).
  const pinFooter = !!params?._pinFooter;

  const itemRows = data.items.map((item, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td><span class="item-name">${escapeHtml(item.name)}</span>${item.color ? ` <span class="item-color">&middot; ${escapeHtml(item.color)}</span>` : ''}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">${formatCurrency(item.unitPrice, data.currency)}</td>
      <td class="r strong">${formatCurrency(item.amount, data.currency)}</td>
    </tr>`).join('');

  const summaryRows = [
    { label: 'Subtotal', value: formatCurrency(data.subtotal, data.currency) },
    { label: 'Shipping Fee', value: formatCurrency(data.shippingFee, data.currency) },
    ...(data.giftBoxCharge > 0
      ? [{ label: 'Gift Box Charge', value: formatCurrency(data.giftBoxCharge, data.currency) }]
      : []),
  ];

  const summaryHtml = summaryRows.map((r) => `
    <div class="trow">
      <span class="t-label">${r.label}</span>
      <span class="t-value">${r.value}</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${data.title} - ${data.invoiceNo}</title>
  <style>
    @page { size: A4; margin: 0; }
    *{ margin:0; padding:0; box-sizing:border-box; }
    html, body{ background:#ffffff; }
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      color:#111827;
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
    }
    .page{
      width:210mm;
      min-height:297mm;
      margin:0 auto;
      background:#ffffff;
      position:relative;
    }
    /* NOTE: block flow only — Chromium cannot paginate (fragment) flex/grid
       containers when printing to PDF, so the page must never be a flex box. */
    .content{ padding-bottom:34mm; }

    /* ── HEADER ── */
    .header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:24px;
      padding:12mm 15mm 8mm;
      border-bottom:1.2mm solid #111827;
    }
    .brand{
      display:flex;
      align-items:center;
      gap:5mm;
      min-width:0;
    }
    .logo-img{
      height:22mm;
      width:auto;
      object-fit:contain;
      display:block;
    }
    .brand-name{
      font-size:16pt;
      font-weight:700;
      color:#111827;
      letter-spacing:-0.2px;
    }
    .brand-meta{
      margin-top:1.2mm;
      font-size:8.5pt;
      line-height:1.45;
      color:#6B7280;
      word-break:break-word;
    }
    .doc-title{ text-align:right; flex-shrink:0; }
    .doc-title h1{
      font-size:21pt;
      font-weight:800;
      color:#111827;
      letter-spacing:3px;
      line-height:1;
    }
    .doc-sub{
      margin-top:1.6mm;
      font-size:9pt;
      color:#6B7280;
    }

    /* ── META BAR ── */
    .meta-bar{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      border-bottom:1px solid #E5E7EB;
      background:#F9FAFB;
    }
    .meta-cell{
      padding:3.5mm 5mm 3.5mm 4mm;
      border-right:1px solid #E5E7EB;
    }
    .meta-cell:last-child{ border-right:none; padding-right:15mm; }
    .meta-cell:first-child{ padding-left:15mm; }
    .meta-cell .m-label{
      font-size:7pt;
      font-weight:700;
      color:#9CA3AF;
      text-transform:uppercase;
      letter-spacing:1px;
    }
    .meta-cell .m-value{
      margin-top:1mm;
      font-size:9.5pt;
      font-weight:600;
      color:#111827;
      word-break:break-word;
    }

    /* ── PARTIES ── */
    .parties{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8mm;
      padding:6mm 15mm 5mm;
    }
    .party{ min-width:0; }
    .party .p-title{
      font-size:7.5pt;
      font-weight:700;
      color:#9CA3AF;
      text-transform:uppercase;
      letter-spacing:1.2px;
      padding-bottom:1.8mm;
      margin-bottom:2.2mm;
      border-bottom:1px solid #E5E7EB;
    }
    .party .p-line{
      font-size:9.5pt;
      line-height:1.55;
      color:#374151;
      word-break:break-word;
    }
    .party .p-name{
      font-size:10.5pt;
      font-weight:700;
      color:#111827;
    }

    /* ── ITEMS TABLE ── */
    .table-wrap{ padding:0 15mm; }
    .items-table{
      width:100%;
      border-collapse:collapse;
      border:1px solid #E5E7EB;
    }
    .items-table thead{ display:table-header-group; }
    .items-table tr{ page-break-inside:avoid; }
    .items-table thead th{
      background:#111827;
      color:#ffffff;
      font-size:8pt;
      font-weight:600;
      text-transform:uppercase;
      letter-spacing:0.8px;
      padding:2.8mm 3.5mm;
      text-align:left;
    }
    .items-table thead th.c{ text-align:center; }
    .items-table thead th.r{ text-align:right; }
    .items-table tbody td{
      border-top:1px solid #E5E7EB;
      padding:2.8mm 3.5mm;
      font-size:9.5pt;
      color:#374151;
      vertical-align:top;
      word-break:break-word;
    }
    .items-table tbody tr:nth-child(even){ background:#F9FAFB; }
    .items-table td.c{ text-align:center; color:#6B7280; }
    .items-table td.r{ text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .items-table td.strong{ font-weight:700; color:#111827; }
    .item-name{ font-weight:600; color:#111827; }
    .item-color{ color:#6B7280; font-weight:400; font-size:8.5pt; }

    /* ── TOTALS ── */
    .totals-section{
      padding:5mm 15mm 5mm;
      display:flex;
      justify-content:flex-end;
      page-break-inside:avoid;
    }
    .totals-box{ width:78mm; }
    .trow{
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:1.6mm 0;
      font-size:9.5pt;
    }
    .t-label{ color:#6B7280; }
    .t-value{ color:#111827; font-weight:500; font-variant-numeric:tabular-nums; }
    .totals-divider{
      border:none;
      border-top:1px solid #D1D5DB;
      margin:2mm 0;
    }
    .grand-row{
      background:#111827;
      color:#ffffff;
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:2.8mm 4mm;
    }
    .grand-row .g-label{
      font-size:9.5pt;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:1px;
    }
    .grand-row .g-value{
      font-size:12pt;
      font-weight:800;
      font-variant-numeric:tabular-nums;
    }

    /* ── WORDS ── */
    .notes{ padding:0 15mm 6mm; page-break-inside:avoid; }
    .words{
      border:1px dashed #D1D5DB;
      border-radius:1.5mm;
      background:#F9FAFB;
      padding:2.8mm 4mm;
      font-size:9pt;
      color:#374151;
      line-height:1.55;
      word-break:break-word;
    }
    .words strong{ color:#111827; }

    /* ── FOOTER ── */
    .footer{
      margin-top:8mm;
      background:#F9FAFB;
      border-top:1px solid #E5E7EB;
      padding:4.5mm 15mm 6mm;
      text-align:center;
      page-break-inside:avoid;
    }
    ${pinFooter ? `
    .content{ padding-bottom:0; }
    .footer{
      position:absolute;
      bottom:0;
      left:0;
      right:0;
      margin-top:0;
    }` : ''}
    .footer .thanks{
      font-size:10pt;
      font-weight:700;
      color:#111827;
    }
    .footer p{
      margin-top:1.2mm;
      font-size:8pt;
      color:#6B7280;
      line-height:1.55;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="content">

      <!-- HEADER -->
      <div class="header">
        <div class="brand">
          ${logoDataUri ? `<img src="${logoDataUri}" class="logo-img" alt="${escapeHtml(data.seller.name)}"/>` : ''}
          <div>
            <div class="brand-name">${escapeHtml(data.seller.name)}</div>
            <div class="brand-meta">
              ${escapeHtml(data.seller.address)}<br/>
              ${escapeHtml(data.seller.phone)} &nbsp;|&nbsp; ${escapeHtml(data.seller.email)}
            </div>
          </div>
        </div>
        <div class="doc-title">
          <h1>INVOICE</h1>
          <div class="doc-sub">${escapeHtml(data.title)}</div>
        </div>
      </div>

      <!-- META -->
      <div class="meta-bar">
        <div class="meta-cell">
          <div class="m-label">Invoice No.</div>
          <div class="m-value">#${escapeHtml(data.invoiceNo)}</div>
        </div>
        <div class="meta-cell">
          <div class="m-label">Date</div>
          <div class="m-value">${escapeHtml(data.date)}</div>
        </div>
        <div class="meta-cell">
          <div class="m-label">Payment Method</div>
          <div class="m-value">${escapeHtml(data.paymentMethod)}</div>
        </div>
        <div class="meta-cell">
          <div class="m-label">Order No.</div>
          <div class="m-value">#${escapeHtml(data.orderNo)}</div>
        </div>
      </div>

      <!-- PARTIES -->
      <div class="parties">
        <div class="party">
          <div class="p-title">From</div>
          <div class="p-line p-name">${escapeHtml(data.seller.name)}</div>
          <div class="p-line">${escapeHtml(data.seller.address)}</div>
          <div class="p-line">Phone: ${escapeHtml(data.seller.phone)}</div>
          <div class="p-line">${escapeHtml(data.seller.email)}</div>
        </div>
        <div class="party">
          <div class="p-title">Bill To</div>
          <div class="p-line p-name">${escapeHtml(data.customer.name)}</div>
          <div class="p-line">${escapeHtml(data.customer.address)}</div>
          <div class="p-line">Phone: ${escapeHtml(data.customer.phone)}</div>
          <div class="p-line">${escapeHtml(String(data.customer.email))}</div>
        </div>
      </div>

      <!-- ITEMS -->
      <div class="table-wrap">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:7%;">S.N</th>
              <th>Description</th>
              <th class="c" style="width:10%;">Qty</th>
              <th class="r" style="width:20%;">Unit Price</th>
              <th class="r" style="width:22%;">Amount</th>
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
          <div class="grand-row">
            <span class="g-label">Total</span>
            <span class="g-value">${formatCurrency(data.totalAmount, data.currency)}</span>
          </div>
        </div>
      </div>

      <!-- AMOUNT IN WORDS -->
      <div class="notes">
        <div class="words">
          <strong>Amount in words:</strong> ${escapeHtml(formatAmountInWords(data.totalAmount, data.currency))}
        </div>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="thanks">Thank you for shopping with ${escapeHtml(data.seller.name)}!</div>
      <p>
        For any questions regarding this invoice, contact us at ${escapeHtml(data.seller.phone)} &nbsp;|&nbsp; ${escapeHtml(data.seller.email)}<br/>
        This is a computer-generated document and does not require a signature.
      </p>
    </div>

  </div>
</body>
</html>`;
};

// ─── BROWSER ─────────────────────────────────────────────────────────────────

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

// ─── A4 PDF GENERATION ───────────────────────────────────────────────────────
// True A4 document (595 x 842 pt). Long orders paginate automatically across
// pages instead of being cut off or shrunk.

const A4_HEIGHT_PX = 1122; // 297mm at CSS 96dpi (Chromium print units)

const _waitForAssets = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready.catch(() => null);
    const imgs = Array.from(document.images || []);
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })
      )
    );
  });

const generateInvoicePdfBuffer = async (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  let browser;
  try {
    const launched = await _launchBrowser();
    if (!launched.browser) {
      console.error(
        '[invoice] Browser launch failed — will fall back to vector SVG invoice:',
        launched.error
      );
      return null;
    }
    browser = launched.browser;
    const page = await browser.newPage();

    // Pass 1: render with a flowing footer and measure the natural content
    // height to decide whether everything fits on a single A4 sheet.
    let html = buildInvoiceHtml({ ...data, _logoDataUri: getLogoDataUri() });
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
    await page.waitForSelector('.page', { timeout: 5000 });
    await _waitForAssets(page);

    const contentHeight = await page.evaluate(() => {
      const el = document.querySelector('.content');
      return Math.ceil(el.getBoundingClientRect().height);
    });

    // Pass 2 (single-page only): pin the footer to the bottom edge of A4.
    if (contentHeight <= A4_HEIGHT_PX - 40) {
      html = buildInvoiceHtml({ ...data, _logoDataUri: getLogoDataUri(), _pinFooter: true });
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
      await page.waitForSelector('.page', { timeout: 5000 });
      await _waitForAssets(page);
    }

    const pdf = await page.pdf({
      width: '210mm',
      height: '297mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      timeout: 30000,
    });
    return Buffer.from(pdf);
  } catch (error) {
    console.error('[invoice] PDF generation failed:', error.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
};

// ─── VECTOR SVG INVOICE (no-headless-Chromium fallback) ──────────────────────
// Full text with word-wrapping — never truncates. Line heights grow
// dynamically so long names/addresses always fit.

const wrapLines = (text, maxChars) => {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length <= maxChars) {
      cur = candidate;
      continue;
    }
    if (cur) lines.push(cur);
    cur = '';
    let rem = w;
    while (rem.length > maxChars) {
      lines.push(rem.slice(0, maxChars));
      rem = rem.slice(maxChars);
    }
    cur = rem;
  }
  if (cur) lines.push(cur);
  return lines;
};

const buildInvoiceSvgMarkup = (data) => {
  const W = 794; // A4 @96dpi width
  const M = 40;
  const font = 'Arial, Helvetica, sans-serif';
  const items = Array.isArray(data.items) ? data.items : [];

  const logoHref = getLogoDataUri();
  const logoW = 62;
  const logoH = Math.round(logoW * (643 / 513));

  // Column geometry (x anchors)
  const colSN = M + 12;
  const colDesc = M + 50;
  const descWidthPx = 330; // px available for description text
  const colQty = 480;
  const colUnit = 650;
  const colAmt = W - M - 12;

  const p = [];
  const T = (x, y, size, fill, content, extra = '') =>
    `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}"${extra}>${content}</text>`;

  // ── Header band ──
  const headerH = Math.max(120, logoH + 36);
  p.push(`<rect x="0" y="0" width="${W}" height="${headerH}" fill="#ffffff"/>`);
  p.push(`<rect x="0" y="${headerH - 4}" width="${W}" height="4" fill="#111827"/>`);

  if (logoHref) {
    p.push(
      `<image x="${M}" y="${Math.round((headerH - logoH) / 2)}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" href="${logoHref}" xlink:href="${logoHref}"/>`
    );
  }
  const brandX = M + (logoHref ? logoW + 14 : 0);
  const brandNameLines = wrapLines(data.seller?.name || 'Aabhushan Gallery', 34);
  let by = Math.round((headerH - logoH) / 2) + 26;
  brandNameLines.forEach((ln) => {
    p.push(T(brandX, by, 24, '#111827', escapeHtml(ln), ' font-weight="bold"'));
    by += 26;
  });
  const sellerMetaLines = [
    ...wrapLines(String(data.seller?.address || ''), 58),
    ...wrapLines(`${data.seller?.phone || ''}   |   ${data.seller?.email || ''}`, 58),
  ];
  sellerMetaLines.forEach((ln, i) => {
    p.push(T(brandX, by + 4 + i * 17, 12, '#6b7280', escapeHtml(ln)));
  });

  p.push(T(W - M, 62, 28, '#111827', 'INVOICE', ' text-anchor="end" font-weight="bold" letter-spacing="3"'));
  p.push(T(W - M, 84, 13, '#6b7280', escapeHtml(String(data.title || 'Order Confirmation')), ' text-anchor="end"'));

  // ── Meta strip ──
  const metaY = headerH + 8;
  p.push(`<rect x="0" y="${metaY}" width="${W}" height="56" fill="#f9fafb"/>`);
  p.push(`<line x1="0" y1="${metaY + 56}" x2="${W}" y2="${metaY + 56}" stroke="#e5e7eb" stroke-width="1"/>`);
  const metaCols = [
    ['INVOICE NO.', `#${String(data.invoiceNo || 'N/A')}`],
    ['DATE', String(data.date || 'N/A')],
    ['PAYMENT METHOD', String(data.paymentMethod || 'N/A')],
    ['ORDER NO.', `#${String(data.orderNo || 'N/A')}`],
  ];
  metaCols.forEach(([label, value], i) => {
    const mx = i === 0 ? M : M + i * 180;
    p.push(T(mx, metaY + 24, 10, '#9ca3af', escapeHtml(label), ' letter-spacing="1"'));
    p.push(T(mx, metaY + 44, 13, '#111827', escapeHtml(value), ' font-weight="bold"'));
  });

  // ── Bill To block (wrapped, dynamic height) ──
  let cy = metaY + 92;
  p.push(T(M, cy, 11, '#9ca3af', 'BILL TO', ' letter-spacing="1.2"'));
  cy += 26;
  p.push(T(M, cy, 16, '#111827', escapeHtml(String(data.customer?.name || 'Valued Customer')), ' font-weight="bold"'));
  cy += 22;

  const custAddr = data.customer?.address && data.customer.address !== 'N/A'
    ? wrapLines(data.customer.address, 88)
    : [];
  custAddr.forEach((ln) => {
    p.push(T(M, cy, 13, '#374151', escapeHtml(ln)));
    cy += 18;
  });
  p.push(T(M, cy, 13, '#374151', escapeHtml(`Phone: ${data.customer?.phone || 'N/A'}`)));
  cy += 18;
  if (data.customer?.email && data.customer.email !== 'N/A') {
    wrapLines(String(data.customer.email), 70).forEach((ln) => {
      p.push(T(M, cy, 13, '#374151', escapeHtml(ln)));
      cy += 18;
    });
  }

  // ── Table header ──
  const tableTop = Math.max(cy + 30, 400);
  const headerRowH = 44;
  p.push(`<rect x="${M}" y="${tableTop}" width="${W - 2 * M}" height="${headerRowH}" fill="#111827"/>`);
  p.push(T(colSN, tableTop + 28, 11, '#ffffff', 'S.N'));
  p.push(T(colDesc, tableTop + 28, 11, '#ffffff', 'DESCRIPTION', ' letter-spacing="0.8"'));
  p.push(T(colQty, tableTop + 28, 11, '#ffffff', 'QTY', ' text-anchor="middle" letter-spacing="0.8"'));
  p.push(T(colUnit, tableTop + 28, 11, '#ffffff', 'UNIT PRICE', ' text-anchor="end" letter-spacing="0.8"'));
  p.push(T(colAmt, tableTop + 28, 11, '#ffffff', 'AMOUNT', ' text-anchor="end" letter-spacing="0.8"'));

  // ── Item rows (wrapped descriptions, variable row heights) ──
  let ry = tableTop + headerRowH;
  const rows = items.length
    ? items
    : [{ name: 'No items', quantity: '', unitPrice: null, amount: null }];
  rows.forEach((item, i) => {
    const nameLines = wrapLines(item.name || 'Product', 46);
    const rowLines = Math.max(nameLines.length, 1);
    const rowH = 14 + rowLines * 17 + 10;

    if (i % 2 === 1) {
      p.push(`<rect x="${M}" y="${ry}" width="${W - 2 * M}" height="${rowH}" fill="#f9fafb"/>`);
    }
    p.push(T(colSN, ry + 24, 13, '#6b7280', items.length ? String(i + 1) : ''));

    let ny = ry + 24;
    nameLines.forEach((ln, li) => {
      p.push(
        T(
          colDesc,
          ny,
          13,
          '#111827',
          escapeHtml(ln),
          li === 0 ? ' font-weight="bold"' : ''
        )
      );
      ny += 17;
    });

    if (items.length) {
      p.push(T(colQty, ry + 24, 13, '#374151', String(item.quantity ?? ''), ' text-anchor="middle"'));
      p.push(T(colUnit, ry + 24, 13, '#374151', item.unitPrice === null ? '' : escapeHtml(formatCurrency(item.unitPrice, data.currency)), ' text-anchor="end"'));
      p.push(T(colAmt, ry + 24, 13, '#111827', item.amount === null ? '' : escapeHtml(formatCurrency(item.amount, data.currency)), ' text-anchor="end" font-weight="bold"'));
    }

    ry += rowH;
    p.push(`<line x1="${M}" y1="${ry}" x2="${W - M}" y2="${ry}" stroke="#e5e7eb" stroke-width="1"/>`);
  });

  // ── Totals ──
  let ty = ry + 34;
  const totalsRows = [['Subtotal', data.subtotal]];
  if (Number(data.shippingFee) > 0) totalsRows.push(['Shipping Fee', data.shippingFee]);
  if (Number(data.giftBoxCharge) > 0) totalsRows.push(['Gift Box Charge', data.giftBoxCharge]);
  totalsRows.forEach(([label, value]) => {
    p.push(T(W - M - 160, ty, 13, '#6b7280', escapeHtml(label), ' text-anchor="end"'));
    p.push(T(colAmt, ty, 13, '#111827', escapeHtml(formatCurrency(value, data.currency)), ' text-anchor="end"'));
    ty += 26;
  });
  p.push(`<line x1="${W - M - 300}" y1="${ty - 8}" x2="${colAmt}" y2="${ty - 8}" stroke="#d1d5db" stroke-width="1"/>`);

  const grandH = 38;
  p.push(`<rect x="${W - M - 340}" y="${ty}" width="340" height="${grandH}" fill="#111827"/>`);
  p.push(T(W - M - 320, ty + 25, 13, '#ffffff', 'TOTAL', ' font-weight="bold" letter-spacing="1"'));
  p.push(T(colAmt, ty + 26, 16, '#ffffff', escapeHtml(formatCurrency(data.totalAmount, data.currency)), ' text-anchor="end" font-weight="bold"'));

  // ── Amount in words (wrapped) ──
  let wy = ty + grandH + 40;
  p.push(T(M, wy, 10, '#9ca3af', 'AMOUNT IN WORDS', ' letter-spacing="1"'));
  wy += 19;
  wrapLines(formatAmountInWords(data.totalAmount, data.currency), 95).forEach((ln) => {
    p.push(T(M, wy, 13, '#374151', escapeHtml(ln)));
    wy += 18;
  });

  // ── Footer ──
  const footerTop = wy + 24;
  p.push(`<line x1="0" y1="${footerTop}" x2="${W}" y2="${footerTop}" stroke="#e5e7eb" stroke-width="1"/>`);
  p.push(T(W / 2, footerTop + 32, 13, '#111827', escapeHtml(`Thank you for shopping with ${data.seller?.name || 'us'}!`), ' text-anchor="middle" font-weight="bold"'));
  p.push(T(W / 2, footerTop + 54, 11, '#6b7280', escapeHtml('This is a computer-generated document and does not require a signature.'), ' text-anchor="middle"'));

  const H = footerTop + 90;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>` +
    p.join('') +
    `</svg>`
  );
};

const buildInvoiceSvg = (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  return buildInvoiceSvgMarkup(data);
};

const generateInvoiceSvgBuffer = (params) =>
  Buffer.from(buildInvoiceSvg(params), 'utf8');

module.exports = {
  buildInvoiceHtml,
  buildInvoiceSvg,
  generateInvoicePdfBuffer,
  generateInvoiceSvgBuffer,
  extractInvoiceData,
  formatCurrency,
};
