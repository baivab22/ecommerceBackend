const { getLogoDataUri } = require('./logoAsset.service');

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
  // South-Asian numbering: ... billion, million, thousand, then last group plain
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

// ─── HTML TEMPLATE ───────────────────────────────────────────────────────────

const buildInvoiceHtml = (params) => {
  const data = params?.invoiceNo ? params : extractInvoiceData(params);
  const logoDataUri = data._logoDataUri || getLogoDataUri();

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
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      background:#F1F3F6;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      color:#111827;
      -webkit-font-smoothing:antialiased;
    }
    .page{
      width:794px;
      margin:0 auto;
      background:#ffffff;
      position:relative;
    }

    /* ── HEADER ── */
    .header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:24px;
      padding:34px 44px 28px;
      border-bottom:4px solid #111827;
    }
    .brand{
      display:flex;
      align-items:center;
      gap:18px;
    }
    .logo-img{
      height:86px;
      width:auto;
      object-fit:contain;
      display:block;
    }
    .brand-name{
      font-size:22px;
      font-weight:700;
      color:#111827;
      letter-spacing:-0.2px;
    }
    .brand-meta{
      margin-top:5px;
      font-size:12px;
      line-height:19px;
      color:#6B7280;
    }
    .doc-title{
      text-align:right;
    }
    .doc-title h1{
      font-size:30px;
      font-weight:800;
      color:#111827;
      letter-spacing:3px;
      line-height:1;
    }
    .doc-sub{
      margin-top:7px;
      font-size:12.5px;
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
      padding:14px 44px 14px 16px;
      border-right:1px solid #E5E7EB;
    }
    .meta-cell:last-child{ border-right:none; }
    .meta-cell .m-label{
      font-size:10px;
      font-weight:700;
      color:#9CA3AF;
      text-transform:uppercase;
      letter-spacing:1px;
    }
    .meta-cell .m-value{
      margin-top:4px;
      font-size:13.5px;
      font-weight:600;
      color:#111827;
      word-break:break-word;
    }

    /* ── PARTIES ── */
    .parties{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:24px;
      padding:26px 44px 24px;
    }
    .party .p-title{
      font-size:10.5px;
      font-weight:700;
      color:#9CA3AF;
      text-transform:uppercase;
      letter-spacing:1.2px;
      padding-bottom:8px;
      margin-bottom:10px;
      border-bottom:1px solid #E5E7EB;
    }
    .party .p-line{
      font-size:13px;
      line-height:21px;
      color:#374151;
    }
    .party .p-name{
      font-size:14.5px;
      font-weight:700;
      color:#111827;
    }

    /* ── ITEMS TABLE ── */
    .table-wrap{ padding:0 44px; }
    .items-table{
      width:100%;
      border-collapse:collapse;
      border:1px solid #E5E7EB;
    }
    .items-table thead th{
      background:#111827;
      color:#ffffff;
      font-size:11px;
      font-weight:600;
      text-transform:uppercase;
      letter-spacing:0.8px;
      padding:11px 14px;
      text-align:left;
    }
    .items-table thead th.c{ text-align:center; }
    .items-table thead th.r{ text-align:right; }
    .items-table tbody td{
      border-top:1px solid #E5E7EB;
      padding:12px 14px;
      font-size:13px;
      color:#374151;
      vertical-align:top;
    }
    .items-table tbody tr:nth-child(even){ background:#F9FAFB; }
    .items-table td.c{ text-align:center; color:#6B7280; }
    .items-table td.r{ text-align:right; font-variant-numeric:tabular-nums; }
    .items-table td.strong{ font-weight:700; color:#111827; }
    .item-name{ font-weight:600; color:#111827; }
    .item-color{ color:#6B7280; font-weight:400; font-size:12px; }

    /* ── TOTALS ── */
    .totals-section{
      padding:22px 44px 26px;
      display:flex;
      justify-content:flex-end;
    }
    .totals-box{ width:330px; }
    .trow{
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:7px 0;
      font-size:13px;
    }
    .t-label{ color:#6B7280; }
    .t-value{ color:#111827; font-weight:500; font-variant-numeric:tabular-nums; }
    .totals-divider{
      border:none;
      border-top:1px solid #D1D5DB;
      margin:9px 0;
    }
    .grand-row{
      background:#111827;
      color:#ffffff;
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:12px 16px;
    }
    .grand-row .g-label{
      font-size:13px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:1px;
    }
    .grand-row .g-value{
      font-size:17px;
      font-weight:800;
      font-variant-numeric:tabular-nums;
    }

    /* ── WORDS + NOTES ── */
    .notes{
      padding:0 44px 30px;
    }
    .words{
      border:1px dashed #D1D5DB;
      border-radius:6px;
      background:#F9FAFB;
      padding:12px 16px;
      font-size:12.5px;
      color:#374151;
      line-height:20px;
    }
    .words strong{ color:#111827; }

    /* ── FOOTER ── */
    .footer{
      background:#F9FAFB;
      border-top:1px solid #E5E7EB;
      padding:18px 44px 22px;
      text-align:center;
    }
    .footer .thanks{
      font-size:13.5px;
      font-weight:700;
      color:#111827;
    }
    .footer p{
      margin-top:5px;
      font-size:11.5px;
      color:#6B7280;
      line-height:18px;
    }
  </style>
</head>
<body>
  <div class="page">

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
        <div class="p-line">${escapeHtml(truncate(String(data.customer.email), 60))}</div>
      </div>
    </div>

    <!-- ITEMS -->
    <div class="table-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:6%;">S.N</th>
            <th>Description</th>
            <th class="c" style="width:10%;">Qty</th>
            <th class="r" style="width:21%;">Unit Price</th>
            <th class="r" style="width:23%;">Amount</th>
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

const PAGE_WIDTH = 794;

const generateInvoicePngBuffer = async (params) => {
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
    const html = buildInvoiceHtml({ ...data, _logoDataUri: getLogoDataUri() });
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_WIDTH, height: 1123, deviceScaleFactor: 2 });
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

// ─── VECTOR SVG INVOICE (no-headless-Chromium fallback) ──────────────────────

const buildInvoiceSvgMarkup = (data) => {
  const W = 800;
  const M = 40;
  const rowH = 36;
  const headerRowH = 44;
  const items = Array.isArray(data.items) ? data.items : [];

  const logoHref = getLogoDataUri();
  const logoW = 62;
  const logoH = Math.round(logoW * (643 / 513));

  const tableTop = 400;
  const tableBottom = tableTop + headerRowH + Math.max(items.length, 1) * rowH;

  let totalsY = tableBottom + 36;
  const totalsRows = [['Subtotal', data.subtotal]];
  if (Number(data.shippingFee) > 0) totalsRows.push(['Shipping', data.shippingFee]);
  if (Number(data.giftBoxCharge) > 0) totalsRows.push(['Gift Box', data.giftBoxCharge]);
  const grandTotalY = totalsY + totalsRows.length * 28 + 20;
  const wordsY = grandTotalY + 40;
  const footerY = wordsY + 46;
  const H = footerY + 70;

  const p = [];
  const T = (x, y, size, fill, content, extra = '') =>
    `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${fill}"${extra}>${content}</text>`;

  // Background + header band
  p.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  p.push(T(W - M, 66, 28, '#111827', 'INVOICE', ' text-anchor="end" font-weight="bold" letter-spacing="3"'));
  p.push(T(W - M, 88, 13, '#6b7280', escapeHtml(String(data.title || 'Order Confirmation')), ' text-anchor="end"'));

  // Logo + brand block
  if (logoHref) {
    p.push(
      `<image x="${M}" y="${Math.max(14, 92 - logoH)}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" href="${logoHref}" xlink:href="${logoHref}"/>`
    );
  }
  const brandX = M + (logoHref ? logoW + 14 : 0);
  p.push(`<rect x="0" y="104" width="${W}" height="4" fill="#111827"/>`);
  p.push(T(brandX, 56, 24, '#111827', escapeHtml(String(data.seller?.name || 'Aabhushan Gallery')), ' font-weight="bold"'));
  p.push(T(brandX, 76, 12, '#6b7280', escapeHtml(String(data.seller?.address || ''))));
  p.push(
    T(
      brandX,
      94,
      12,
      '#6b7280',
      escapeHtml(`${data.seller?.phone || ''}   |   ${data.seller?.email || ''}`)
    )
  );

  // Meta strip
  p.push(`<rect x="0" y="108" width="${W}" height="52" fill="#f9fafb"/>`);
  const metaCols = [
    ['INVOICE NO.', `#${String(data.invoiceNo || 'N/A')}`],
    ['DATE', String(data.date || 'N/A')],
    ['PAYMENT METHOD', String(data.paymentMethod || 'N/A')],
  ];
  let mx = M;
  metaCols.forEach(([label, value]) => {
    p.push(T(mx, 130, 10, '#9ca3af', escapeHtml(label), ' letter-spacing="1"'));
    p.push(T(mx, 148, 13, '#111827', escapeHtml(value), ' font-weight="bold"'));
    mx += 240;
  });

  // Customer block
  p.push(T(M, 200, 11, '#9ca3af', 'BILL TO', ' letter-spacing="1.2"'));
  p.push(T(M, 224, 16, '#111827', escapeHtml(truncate(data.customer?.name || 'Valued Customer', 44)), ' font-weight="bold"'));
  if (data.customer?.address && data.customer.address !== 'N/A') {
    p.push(T(M, 246, 13, '#374151', escapeHtml(truncate(data.customer.address, 70))));
  }
  p.push(T(M, data.customer?.address && data.customer.address !== 'N/A' ? 266 : 246, 13, '#374151', escapeHtml(`Phone: ${data.customer?.phone || 'N/A'}`)));
  if (data.customer?.email && data.customer.email !== 'N/A') {
    p.push(T(M, data.customer?.address && data.customer.address !== 'N/A' ? 286 : 266, 13, '#374151', escapeHtml(truncate(String(data.customer.email), 60))));
  }

  // Table header
  p.push(`<rect x="${M}" y="${tableTop}" width="${W - 2 * M}" height="${headerRowH}" fill="#111827"/>`);
  p.push(T(M + 12, tableTop + 28, 11, '#ffffff', 'S.N', ''));
  p.push(T(M + 50, tableTop + 28, 11, '#ffffff', 'DESCRIPTION', ' letter-spacing="0.8"'));
  p.push(T(480, tableTop + 28, 11, '#ffffff', 'QTY', ' text-anchor="middle" letter-spacing="0.8"'));
  p.push(T(650, tableTop + 28, 11, '#ffffff', 'UNIT PRICE', ' text-anchor="end" letter-spacing="0.8"'));
  p.push(T(W - M - 12, tableTop + 28, 11, '#ffffff', 'AMOUNT', ' text-anchor="end" letter-spacing="0.8"'));
  p.push(`<line x1="${M}" y1="${tableTop + headerRowH}" x2="${W - M}" y2="${tableTop + headerRowH}" stroke="#d1d5db" stroke-width="1"/>`);

  // Item rows
  const rows = items.length
    ? items
    : [{ name: 'No items', quantity: '', unitPrice: null, amount: null }];
  rows.forEach((item, i) => {
    const y = tableTop + headerRowH + i * rowH + 24;
    if (i % 2 === 1) {
      p.push(`<rect x="${M}" y="${y - 20}" width="${W - 2 * M}" height="${rowH}" fill="#f9fafb"/>`);
    }
    p.push(T(M + 12, y, 13, '#6b7280', items.length ? String(i + 1) : ''));
    p.push(T(M + 50, y, 13, '#111827', escapeHtml(truncate(item.name || 'Product', 48)), ' font-weight="bold"'));
    if (items.length) {
      p.push(T(480, y, 13, '#374151', String(item.quantity ?? ''), ' text-anchor="middle"'));
      p.push(T(650, y, 13, '#374151', item.unitPrice === null ? '' : escapeHtml(formatCurrency(item.unitPrice, data.currency)), ' text-anchor="end"'));
      p.push(T(W - M - 12, y, 13, '#111827', item.amount === null ? '' : escapeHtml(formatCurrency(item.amount, data.currency)), ' text-anchor="end" font-weight="bold"'));
    }
    if (i < rows.length - 1) {
      const ly = tableTop + headerRowH + (i + 1) * rowH;
      p.push(`<line x1="${M}" y1="${ly}" x2="${W - M}" y2="${ly}" stroke="#e5e7eb" stroke-width="1"/>`);
    }
  });

  // Totals
  totalsRows.forEach(([label, value]) => {
    p.push(T(600, totalsY, 13, '#6b7280', escapeHtml(label), ' text-anchor="end"'));
    p.push(T(W - M - 12, totalsY, 13, '#111827', escapeHtml(formatCurrency(value, data.currency)), ' text-anchor="end"'));
    totalsY += 28;
  });
  p.push(`<line x1="${W - M - 260}" y1="${grandTotalY - 24}" x2="${W - M}" y2="${grandTotalY - 24}" stroke="#d1d5db" stroke-width="1"/>`);
  p.push(`<rect x="${W - M - 320}" y="${grandTotalY - 20}" width="${320}" height="34" fill="#111827"/>`);
  p.push(T(W - M - 300, grandTotalY + 2, 13, '#ffffff', 'TOTAL', ' font-weight="bold" letter-spacing="1"'));
  p.push(T(W - M - 12, grandTotalY + 3, 16, '#ffffff', escapeHtml(formatCurrency(data.totalAmount, data.currency)), ' text-anchor="end" font-weight="bold"'));

  // Amount in words
  p.push(T(M, wordsY, 12, '#6b7280', escapeHtml(`Amount in words: ${formatAmountInWords(data.totalAmount, data.currency)}`)));

  // Footer
  p.push(`<line x1="0" y1="${footerY - 28}" x2="${W}" y2="${footerY - 28}" stroke="#e5e7eb" stroke-width="1"/>`);
  p.push(T(W / 2, footerY, 13, '#111827', escapeHtml(`Thank you for shopping with ${data.seller?.name || 'us'}!`), ' text-anchor="middle" font-weight="bold"'));
  p.push(T(W / 2, footerY + 22, 11, '#6b7280', escapeHtml('This is a computer-generated document and does not require a signature.'), ' text-anchor="middle"'));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
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
