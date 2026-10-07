const fs = require('fs');
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
      name: 'Abhushan Gallery',
      address: 'Kalimati, Kathmandu, Nepal',
      phone: '+977 9861698400',
      email: senderEmail || 'support@aabhushangallery.com',
    },
    customer: {
      // customerName is derived from order.name first (see emailServices), so
      // the invoice shows the name typed at checkout rather than the account
      // name. The later fallbacks keep older orders printing something.
      name: customerName || order?.name || order?.fullName || 'Valued Customer',
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
let _sharpCache;

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

// Servers that run `npm ci --omit=dev` (cPanel included) often skip Puppeteer's
// postinstall, which is what downloads the bundled Chrome. PDF generation then
// fails with "Could not find Chrome" and the caller silently degrades to a
// fallback format. Resolve an executable explicitly and, failing that, say so
// loudly instead of returning null and letting the format change unnoticed.
const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const _resolveExecutablePath = () => {
  // If Puppeteer's own download succeeded, use it — it is version-matched.
  try {
    const bundled = _loadPuppeteer()?.executablePath?.();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    // fall through to system browsers
  }

  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore unreadable paths
    }
  }

  return null;
};

const _launchBrowser = async () => {
  const puppeteer = _loadPuppeteer();
  if (!puppeteer) {
    return { browser: null, error: 'puppeteer is not installed' };
  }

  const executablePath = _resolveExecutablePath();
  if (!executablePath) {
    return {
      browser: null,
      error:
        'No Chrome/Chromium binary found. Run `npx puppeteer browsers install chrome`, ' +
        'or set PUPPETEER_EXECUTABLE_PATH.',
    };
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
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
        '[invoice] Browser launch failed — using the native PDF renderer:',
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
  const brandNameLines = wrapLines(data.seller?.name || 'Abhushan Gallery', 34);
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

// ─── RASTER FALLBACK ─────────────────────────────────────────────────────────
// Email clients render SVG inconsistently — several refuse to display it at
// all, and Outlook/Word-based clients treat it as an untrusted document. So the
// no-Chromium path rasterises the same markup to PNG rather than shipping a
// vector file the customer cannot open. Rasterising needs no browser, which is
// the entire point: this is the path taken when Chromium is unavailable.

const _loadSharp = () => {
  if (_sharpCache !== undefined) return _sharpCache;
  try {
    _sharpCache = require('sharp');
  } catch (err) {
    console.error('[invoice] sharp not available for raster fallback:', err.message);
    _sharpCache = null;
  }
  return _sharpCache;
};

// 2x density against an A4-ish viewBox keeps text crisp at 100% zoom on a
// retina screen without producing a file too large to email.
const RASTER_DENSITY = 200;

const generateInvoicePngBuffer = async (params) => {
  const sharpLib = _loadSharp();
  if (!sharpLib) return null;

  try {
    const svg = buildInvoiceSvg(params);
    return await sharpLib(Buffer.from(svg, 'utf8'), { density: RASTER_DENSITY })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    console.error('[invoice] PNG rasterisation failed:', err.message);
    return null;
  }
};

// ─── NATIVE PDF FALLBACK (no Chromium) ───────────────────────────────────────
// Puppeteer needs a Chrome binary. On hosts where it is missing (a cPanel
// `npm ci --omit=dev` skips Puppeteer's Chrome download) the old behaviour was
// to rasterise the invoice to SVG and hand that to sharp — and librsvg on those
// machines has no matching fonts, so the customer received an image bill with
// broken or missing glyphs.
//
// This renderer draws the same invoice data directly as a real PDF: text is
// text (selectable, searchable, always the right characters) using the PDF
// standard Helvetica fonts, which require no browser and no system fonts at
// all. It is the guaranteed PDF path — used whenever Chromium cannot run.

const NATIVE_PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const NATIVE_MARGIN = 42.5; // 15mm
const NATIVE_BOTTOM_RESERVE = 56; // never draw table rows below this

const NATIVE_COLORS = {
  ink: '#111827',
  body: '#374151',
  muted: '#6B7280',
  light: '#9CA3AF',
  border: '#E5E7EB',
  rule: '#D1D5DB',
  bg: '#F9FAFB',
  white: '#ffffff',
};

let _pdfKitCache;
const _loadPdfKit = () => {
  if (_pdfKitCache !== undefined) return _pdfKitCache;
  try {
    _pdfKitCache = require('pdfkit');
  } catch (err) {
    console.error('[invoice] pdfkit not available for native PDF fallback:', err.message);
    _pdfKitCache = null;
  }
  return _pdfKitCache;
};

// PNG dimensions straight from the IHDR chunk — enough to scale the logo
// without pulling in an image decoder.
const _readPngSize = (buf) => {
  try {
    if (buf && buf.length > 24 && buf.slice(1, 4).toString('ascii') === 'PNG') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
  } catch {
    // unreadable buffer — treat as no logo
  }
  return null;
};

const _logoBuffer = () => {
  const dataUri = getLogoDataUri();
  if (!dataUri || !dataUri.startsWith('data:image/png;base64,')) return null;
  try {
    return Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');
  } catch {
    return null;
  }
};

const _drawNativeInvoice = (doc, data) => {
  const L = NATIVE_MARGIN;
  const R = NATIVE_PAGE.width - NATIVE_MARGIN;
  const W = R - L;
  const seller = data.seller || {};
  const customer = data.customer || {};

  // ── HEADER ──
  const headerTop = 34;
  const logoBuf = _logoBuffer();
  const logoSize = logoBuf ? _readPngSize(logoBuf) : null;
  const logoH = 58;
  const logoW = logoSize ? Math.round(logoH * (logoSize.width / logoSize.height)) : 0;
  if (logoBuf) doc.image(logoBuf, L, headerTop, { height: logoH });

  const brandX = L + (logoBuf ? logoW + 14 : 0);
  const brandW = Math.max(150, L + W * 0.55 - brandX);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(NATIVE_COLORS.ink)
    .text(String(seller.name || 'Abhushan Gallery'), brandX, headerTop + 6, { width: brandW });
  doc.font('Helvetica').fontSize(8.5).fillColor(NATIVE_COLORS.muted)
    .text(String(seller.address || ''), brandX, doc.y + 4, { width: brandW, lineGap: 2 });
  doc.text(`${seller.phone || ''}  |  ${seller.email || ''}`, doc.x, doc.y, { width: brandW });

  doc.font('Helvetica-Bold').fontSize(21).fillColor(NATIVE_COLORS.ink)
    .text('INVOICE', L, headerTop + 2, { width: W, align: 'right', characterSpacing: 3 });
  doc.font('Helvetica').fontSize(9).fillColor(NATIVE_COLORS.muted)
    .text(String(data.title || 'Order Confirmation'), L, doc.y + 5, { width: W, align: 'right' });

  const headerBottom = Math.max(doc.y, headerTop + logoH) + 16;
  doc.rect(0, headerBottom, NATIVE_PAGE.width, 3.4).fill(NATIVE_COLORS.ink);

  // ── META BAR ──
  const metaTop = headerBottom + 3.4;
  const metaH = 40;
  doc.rect(0, metaTop, NATIVE_PAGE.width, metaH).fill(NATIVE_COLORS.bg);
  doc.rect(0, metaTop + metaH - 1, NATIVE_PAGE.width, 1).fill(NATIVE_COLORS.border);

  const cellW = W / 4;
  [
    ['Invoice No.', `#${data.invoiceNo || 'N/A'}`],
    ['Date', data.date || 'N/A'],
    ['Payment Method', data.paymentMethod || 'N/A'],
    ['Order No.', `#${data.orderNo || 'N/A'}`],
  ].forEach(([label, value], i) => {
    const cx = L + i * cellW;
    if (i > 0) doc.rect(cx - 7, metaTop + 8, 1, metaH - 16).fill(NATIVE_COLORS.border);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(NATIVE_COLORS.light)
      .text(label.toUpperCase(), cx, metaTop + 10, { width: cellW - 12, characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NATIVE_COLORS.ink)
      .text(String(value), cx, metaTop + 23, { width: cellW - 12 });
  });

  // ── PARTIES ──
  let y = metaTop + metaH + 20;
  const colGap = 20;
  const colW = (W - colGap) / 2;
  const drawParty = (title, lines, x) => {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NATIVE_COLORS.light)
      .text(title.toUpperCase(), x, y, { width: colW, characterSpacing: 1.2 });
    const ruleY = doc.y + 5;
    doc.rect(x, ruleY, colW, 1).fill(NATIVE_COLORS.border);
    let ly = ruleY + 8;
    lines.filter(Boolean).forEach((line, i) => {
      doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(i === 0 ? 10.5 : 9.5)
        .fillColor(i === 0 ? NATIVE_COLORS.ink : NATIVE_COLORS.body)
        .text(String(line), x, ly, { width: colW, lineGap: 1 });
      ly = doc.y + 3;
    });
    return ly;
  };
  const partiesBottom = Math.max(
    drawParty('From', [seller.name, seller.address, `Phone: ${seller.phone}`, seller.email], L),
    drawParty('Bill To', [customer.name, customer.address, `Phone: ${customer.phone}`, customer.email], L + colW + colGap)
  );
  y = partiesBottom + 16;

  // ── ITEMS TABLE ──
  const colSN = L + 8;
  const colDescX = L + 42;
  const descW = 246;
  const colQtyCx = L + 320;
  const colUnitRight = L + 432;
  const colAmtRight = R - 8;

  const drawTableHeader = (ty) => {
    doc.rect(L, ty, W, 24).fill(NATIVE_COLORS.ink);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NATIVE_COLORS.white);
    doc.text('S.N', colSN, ty + 8.5, { characterSpacing: 0.8 });
    doc.text('DESCRIPTION', colDescX, ty + 8.5, { characterSpacing: 0.8 });
    doc.text('QTY', colQtyCx - 40, ty + 8.5, { width: 80, align: 'center', characterSpacing: 0.8 });
    doc.text('UNIT PRICE', colUnitRight - 110, ty + 8.5, { width: 110, align: 'right', characterSpacing: 0.8 });
    doc.text('AMOUNT', colAmtRight - 110, ty + 8.5, { width: 110, align: 'right', characterSpacing: 0.8 });
    return ty + 24;
  };

  y = drawTableHeader(y);
  const items = (data.items || []).length
    ? data.items
    : [{ name: 'No items', quantity: '', unitPrice: 0, amount: 0 }];

  items.forEach((item, i) => {
    const desc = item.color ? `${item.name} · ${item.color}` : String(item.name);
    const textH = doc.font('Helvetica-Bold').fontSize(9.5).heightOfString(desc, { width: descW });
    const rowH = Math.max(22, textH + 13);

    if (y + rowH > NATIVE_PAGE.height - NATIVE_BOTTOM_RESERVE) {
      doc.addPage();
      y = drawTableHeader(NATIVE_MARGIN);
    }

    if (i % 2 === 1) doc.rect(L, y, W, rowH).fill(NATIVE_COLORS.bg);

    doc.font('Helvetica').fontSize(9.5).fillColor(NATIVE_COLORS.muted)
      .text(String(i + 1), colSN, y + 7, { width: 28 });

    let textY = y + 7;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NATIVE_COLORS.ink)
      .text(String(item.name), colDescX, textY, { width: descW, continued: !!item.color });
    if (item.color) {
      doc.font('Helvetica').fontSize(8.5).fillColor(NATIVE_COLORS.muted).text(` · ${item.color}`);
    }

    doc.font('Helvetica').fontSize(9.5).fillColor(NATIVE_COLORS.body)
      .text(String(item.quantity ?? ''), colQtyCx - 40, textY, { width: 80, align: 'center' });
    doc.text(formatCurrency(item.unitPrice, data.currency), colUnitRight - 110, textY, { width: 110, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(NATIVE_COLORS.ink)
      .text(formatCurrency(item.amount, data.currency), colAmtRight - 110, textY, { width: 110, align: 'right' });

    y += rowH;
    doc.rect(L, y, W, 1).fill(NATIVE_COLORS.border);
  });

  // ── TOTALS ──
  y += 22;
  if (y > NATIVE_PAGE.height - 180) {
    doc.addPage();
    y = NATIVE_MARGIN;
  }
  const boxW = 250;
  const boxX = R - boxW;
  const totalRows = [['Subtotal', data.subtotal]];
  if (Number(data.shippingFee) > 0) totalRows.push(['Shipping Fee', data.shippingFee]);
  if (Number(data.giftBoxCharge) > 0) totalRows.push(['Gift Box Charge', data.giftBoxCharge]);

  totalRows.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(NATIVE_COLORS.muted)
      .text(label, boxX, y, { width: boxW - 120 });
    doc.fillColor(NATIVE_COLORS.ink)
      .text(formatCurrency(value, data.currency), boxX, y, { width: boxW, align: 'right' });
    y += 15;
  });

  doc.rect(boxX, y, boxW, 1).fill(NATIVE_COLORS.rule);
  y += 8;
  doc.rect(boxX, y, boxW, 26).fill(NATIVE_COLORS.ink);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NATIVE_COLORS.white)
    .text('TOTAL', boxX + 10, y + 8.5, { characterSpacing: 1 });
  doc.fontSize(12).text(formatCurrency(data.totalAmount, data.currency), boxX, y + 6, { width: boxW - 10, align: 'right' });
  y += 26 + 20;

  // ── AMOUNT IN WORDS ──
  const words = formatAmountInWords(data.totalAmount, data.currency);
  const wordsH = doc.font('Helvetica').fontSize(9)
    .heightOfString(words, { width: W - 24 }) + 16;
  doc.rect(L, y, W, wordsH).fill(NATIVE_COLORS.bg);
  doc.lineWidth(1).dash(3, { space: 3 }).strokeColor(NATIVE_COLORS.rule).rect(L, y, W, wordsH).stroke();
  doc.undash();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(NATIVE_COLORS.ink)
    .text('Amount in words: ', L + 10, y + 8, { continued: true, width: W - 20 });
  doc.font('Helvetica').fillColor(NATIVE_COLORS.body).text(words, { width: W - 20 });
  y += wordsH + 22;

  // ── FOOTER ──
  if (y > NATIVE_PAGE.height - 110) {
    doc.addPage();
    y = NATIVE_MARGIN;
  }
  doc.rect(0, y, NATIVE_PAGE.width, 1).fill(NATIVE_COLORS.border);
  y += 16;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NATIVE_COLORS.ink)
    .text(`Thank you for shopping with ${seller.name || 'us'}!`, L, y, { width: W, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(NATIVE_COLORS.muted)
    .text(`For any questions regarding this invoice, contact us at ${seller.phone || ''}  |  ${seller.email || ''}`,
      L, doc.y + 5, { width: W, align: 'center' });
  doc.text('This is a computer-generated document and does not require a signature.',
    L, doc.y + 3, { width: W, align: 'center' });
};

const generateInvoiceNativePdfBuffer = (params) => {
  const PDFDocument = _loadPdfKit();
  if (!PDFDocument) return Promise.resolve(null);

  let data;
  try {
    data = params?.invoiceNo ? params : extractInvoiceData(params);
  } catch (err) {
    console.error('[invoice] native PDF data extraction failed:', err.message);
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `${data.title || 'Order Invoice'} - ${data.invoiceNo}`,
          Author: data.seller?.name || 'Abhushan Gallery',
          Subject: `Invoice #${data.invoiceNo}`,
        },
      });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', (err) => {
        console.error('[invoice] native PDF generation failed:', err.message);
        resolve(null);
      });
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      _drawNativeInvoice(doc, data);
      doc.end();
    } catch (err) {
      console.error('[invoice] native PDF generation failed:', err.message);
      resolve(null);
    }
  });
};

module.exports = {
  buildInvoiceHtml,
  buildInvoiceSvg,
  generateInvoicePdfBuffer,
  generateInvoiceNativePdfBuffer,
  generateInvoiceSvgBuffer,
  generateInvoicePngBuffer,
  extractInvoiceData,
  formatCurrency,
};
