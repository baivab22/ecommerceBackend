const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../../client/public/assets/images/logosss.png');

const formatCurrency = (amount) =>
  `NPR ${Number(amount || 0).toLocaleString('en-NP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getLogoDataUri = () => {
  if (!fs.existsSync(LOGO_PATH)) return '';
  const imageBuffer = fs.readFileSync(LOGO_PATH);
  const base64 = imageBuffer.toString('base64');
  return `data:image/png;base64,${base64}`;
};

const escapeXml = (value) =>
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

// ─── HTML INVOICE ────────────────────────────────────────────────────────────

const buildInvoiceHtml = ({
  order,
  customerEmail,
  customerName,
  senderEmail,
  title = 'Invoice',
}) => {
  const orderId = order?.productOrderId || String(order?._id || '').slice(-8).toUpperCase();
  const orderDate = order?.OrderedAt ? new Date(order.OrderedAt) : new Date();

  const totalQuantity = (order?.products || []).reduce(
    (sum, item) => sum + Number(item?.quantity || 0), 0
  );
  const subtotal = (order?.products || []).reduce(
    (sum, item) => sum + Number(item?.price || 0), 0
  );
  const shippingPrice = Number(order?.shippingPrice || 0);
  const giftBoxCharge = Number(order?.includeGiftBox ? 400 : order?.giftBoxCharge || 0);
  const totalAmount = Number(order?.totalAmount || subtotal + shippingPrice + giftBoxCharge);
  const logoDataUri = getLogoDataUri();

  const formattedDate = orderDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const productRows = (order?.products || [])
    .map((product, index) => {
      const quantity = Number(product?.quantity || 1);
      const lineTotal = Number(product?.price || 0);
      const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;
      const itemName = truncate(product?.productId?.name || 'Product', 38);
      const isEven = index % 2 === 0;

      return `
        <tr style="background: ${isEven ? '#ffffff' : '#f9fafb'};">
          <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 5%; vertical-align: top;">${index + 1}</td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827; width: 45%; vertical-align: top; word-break: break-word;">${itemName}</td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; width: 12%; text-align: center; vertical-align: top;">${quantity}</td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; width: 18%; text-align: right; vertical-align: top;">${formatCurrency(unitPrice)}</td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827; font-weight: 600; width: 20%; text-align: right; vertical-align: top;">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title} - ${orderId}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #f1f5f9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1e293b;
          padding: 32px;
          -webkit-font-smoothing: antialiased;
        }
        .sheet {
          width: 900px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }

        /* ── HEADER ── */
        .header {
          background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
          padding: 32px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo { max-width: 160px; height: auto; display: block; }
        .header-right { text-align: right; }
        .header-right h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .header-right p {
          margin: 6px 0 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.75);
          font-weight: 400;
        }

        /* ── META STRIP ── */
        .meta-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .meta-cell {
          padding: 16px 28px;
          border-right: 1px solid #e5e7eb;
        }
        .meta-cell:last-child { border-right: none; }
        .meta-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #94a3b8;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .meta-value {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }

        /* ── CONTENT ── */
        .content { padding: 28px 40px 36px; }

        /* ── PARTIES ── */
        .parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }
        .party-card {
          background: #f8fafc;
          border-radius: 10px;
          padding: 18px 20px;
          border: 1px solid #e2e8f0;
        }
        .party-card h3 {
          margin: 0 0 10px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #64748b;
          font-weight: 700;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
        }
        .party-card p {
          margin: 4px 0;
          font-size: 13px;
          color: #334155;
          line-height: 1.6;
        }
        .party-card .name {
          font-weight: 600;
          color: #0f172a;
          font-size: 14px;
        }

        /* ── TABLE ── */
        .items-section { margin-bottom: 24px; }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .items-table thead th {
          background: #1e3a5f;
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 12px 14px;
          text-align: left;
          border: none;
        }
        .items-table thead th:first-child { padding-left: 16px; }
        .items-table thead th.num { text-align: center; }
        .items-table thead th.right { text-align: right; }

        /* ── SUMMARY ── */
        .summary-wrap {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }
        .summary {
          width: 320px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px 20px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 0;
          font-size: 13px;
          color: #475569;
        }
        .summary-row.total {
          margin-top: 10px;
          padding-top: 12px;
          border-top: 2px solid #1e3a5f;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }
        .summary-row.total .amount {
          color: #2563eb;
        }

        /* ── FOOTER ── */
        .footer {
          text-align: center;
          padding: 18px 40px;
          background: #f8fafc;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <!-- Header -->
        <div class="header">
          <div>
            ${logoDataUri ? `<img src="${logoDataUri}" class="logo" alt="Brand Logo" />` : ''}
          </div>
          <div class="header-right">
            <h1>${title}</h1>
            <p>Order #${orderId}</p>
          </div>
        </div>

        <!-- Meta Strip -->
        <div class="meta-strip">
          <div class="meta-cell">
            <div class="meta-label">Invoice No</div>
            <div class="meta-value">${orderId}</div>
          </div>
          <div class="meta-cell">
            <div class="meta-label">Date</div>
            <div class="meta-value">${formattedDate}</div>
          </div>
          <div class="meta-cell">
            <div class="meta-label">Total Items</div>
            <div class="meta-value">${totalQuantity}</div>
          </div>
        </div>

        <div class="content">
          <!-- Parties -->
          <div class="parties">
            <div class="party-card">
              <h3>From</h3>
              <p class="name">Abhushan Gallery</p>
              <p>Kalimati, Kathmandu, Nepal</p>
              <p>Phone: 9861698400</p>
              <p>${senderEmail || 'support@abhushangallery.com'}</p>
            </div>
            <div class="party-card">
              <h3>Bill To</h3>
              <p class="name">${customerName || 'Valued Customer'}</p>
              ${order?.shippingLocation ? `<p>${order.shippingLocation}</p>` : ''}
              ${order?.locationAddress ? `<p>${order.locationAddress}</p>` : ''}
              <p>Phone: ${order?.phoneNumber || 'N/A'}</p>
              <p>${customerEmail || ''}</p>
            </div>
          </div>

          <!-- Items Table -->
          <div class="items-section">
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 5%; padding-left: 16px;">#</th>
                  <th style="width: 45%;">Item Description</th>
                  <th class="num" style="width: 12%;">Qty</th>
                  <th class="right" style="width: 18%;">Unit Price</th>
                  <th class="right" style="width: 20%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>
          </div>

          <!-- Summary -->
          <div class="summary-wrap">
            <div class="summary">
              <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
              <div class="summary-row"><span>Shipping Fee</span><span>${formatCurrency(shippingPrice)}</span></div>
              ${giftBoxCharge > 0 ? `<div class="summary-row"><span>Gift Box</span><span>${formatCurrency(giftBoxCharge)}</span></div>` : ''}
              <div class="summary-row total"><span>Total</span><span class="amount">${formatCurrency(totalAmount)}</span></div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          Thank you for shopping with Abhushan Gallery. This is a system-generated invoice.
        </div>
      </div>
    </body>
    </html>
  `;
};

// ─── SVG INVOICE ─────────────────────────────────────────────────────────────

const buildInvoiceSvg = ({ order, customerEmail, customerName, senderEmail, title = 'Order Confirmation' }) => {
  const orderId = order?.productOrderId || String(order?._id || '').slice(-8).toUpperCase();
  const orderDate = order?.OrderedAt ? new Date(order.OrderedAt) : new Date();
  const items = order?.products || [];
  const logoDataUri = getLogoDataUri();

  const totalQuantity = items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item?.price || 0), 0);
  const shippingPrice = Number(order?.shippingPrice || 0);
  const giftBoxCharge = Number(order?.includeGiftBox ? 400 : order?.giftBoxCharge || 0);
  const totalAmount = Number(order?.totalAmount || subtotal + shippingPrice + giftBoxCharge);

  const formattedDate = orderDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const wrapText = (text, maxChars = 44) => {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const words = raw.split(/\s+/);
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const next = currentLine ? `${currentLine} ${word}` : word;
      if (next.length <= maxChars) {
        currentLine = next;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3);
  };

  const fromEmail = escapeXml(senderEmail || 'support@abhushangallery.com');
  const customerDisplayName = escapeXml(truncate(customerName || 'Valued Customer', 30));
  const phone = escapeXml(order?.phoneNumber || 'N/A');
  const email = escapeXml(truncate(customerEmail || '', 30));

  // Dynamic address lines for "Bill To"
  const billToLines = [
    ...wrapText(order?.shippingLocation || '', 44),
    ...wrapText(order?.locationAddress || '', 44),
  ].slice(0, 3);

  const billToTextElements = billToLines.map((line, i) =>
    `<text x="870" y="${500 + i * 38}" font-size="28" fill="#475569">${escapeXml(truncate(line, 44))}</text>`
  ).join('\n    ');

  const billToBaseY = 500 + billToLines.length * 38;

  // Table header position
  const tableHeaderY = Math.max(billToBaseY + 60, 680);

  // Dynamic product rows
  const ROW_HEIGHT = 46;
  const productRows = items.slice(0, 8).map((item, index) => {
    const quantity = Number(item?.quantity || 1);
    const lineTotal = Number(item?.price || 0);
    const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;
    const y = tableHeaderY + 52 + index * ROW_HEIGHT;
    const itemName = truncate(item?.productId?.name || 'Product', 42);
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <rect x="32" y="${y - 6}" width="1576" height="${ROW_HEIGHT}" fill="${bgColor}" />
      <line x1="32" y1="${y + ROW_HEIGHT - 6}" x2="1608" y2="${y + ROW_HEIGHT - 6}" stroke="#e5e7eb" stroke-width="1" />
      <text x="52" y="${y + 26}" font-size="27" fill="#94a3b8">${index + 1}</text>
      <text x="160" y="${y + 26}" font-size="27" fill="#1e293b">${escapeXml(itemName)}</text>
      <text x="970" y="${y + 26}" font-size="27" fill="#475569" text-anchor="middle">${quantity}</text>
      <text x="1260" y="${y + 26}" font-size="27" fill="#475569" text-anchor="end">${escapeXml(formatCurrency(unitPrice))}</text>
      <text x="1588" y="${y + 26}" font-size="27" fill="#1e293b" font-weight="600" text-anchor="end">${escapeXml(formatCurrency(lineTotal))}</text>
    `;
  }).join('');

  const tableBottom = tableHeaderY + 52 + Math.min(items.length, 8) * ROW_HEIGHT;

  // Summary section
  const summaryY = tableBottom + 40;
  const summaryLines = [
    { label: 'Subtotal', value: formatCurrency(subtotal), bold: false },
    { label: 'Shipping Fee', value: formatCurrency(shippingPrice), bold: false },
  ];
  if (giftBoxCharge > 0) {
    summaryLines.push({ label: 'Gift Box', value: formatCurrency(giftBoxCharge), bold: false });
  }
  summaryLines.push({ label: 'Total', value: formatCurrency(totalAmount), bold: true });

  const summaryHeight = 30 + summaryLines.length * 44 + 20;

  const summaryTextElements = summaryLines.map((line, i) => {
    const y = summaryY + 36 + i * 44;
    if (line.bold) {
      return `
        <line x1="1068" y1="${y - 12}" x2="1600" y2="${y - 12}" stroke="#1e3a5f" stroke-width="2" />
        <text x="1080" y="${y + 10}" font-size="34" font-weight="700" fill="#0f172a">${line.label}</text>
        <text x="1588" y="${y + 10}" font-size="34" font-weight="700" fill="#2563eb" text-anchor="end">${escapeXml(line.value)}</text>
      `;
    }
    return `
      <text x="1080" y="${y + 10}" font-size="28" fill="#475569">${line.label}</text>
      <text x="1588" y="${y + 10}" font-size="28" fill="#475569" text-anchor="end">${escapeXml(line.value)}</text>
    `;
  }).join('\n    ');

  const totalHeight = summaryY + summaryHeight + 60;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1640" height="${totalHeight}" viewBox="0 0 1640 ${totalHeight}">
    <!-- Background -->
    <rect width="1640" height="${totalHeight}" fill="#f1f5f9" />
    <rect x="1" y="1" width="1638" height="${totalHeight - 2}" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />

    <!-- Header -->
    <defs>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1e3a5f" />
        <stop offset="100%" stop-color="#2563eb" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="1636" height="180" rx="18" fill="url(#headerGrad)" />

    ${logoDataUri
      ? `<image href="${logoDataUri}" x="44" y="28" width="180" height="124" preserveAspectRatio="xMidYMid meet" />`
      : `<text x="52" y="105" font-size="40" font-weight="700" fill="#ffffff">ABHUSHAN</text>
         <text x="52" y="148" font-size="34" font-weight="700" fill="rgba(255,255,255,0.7)">GALLERY</text>`}

    <text x="1100" y="95" font-size="48" font-weight="700" fill="#ffffff" text-anchor="end">${escapeXml(title)}</text>
    <text x="1100" y="140" font-size="28" fill="rgba(255,255,255,0.7)" text-anchor="end">Order #${escapeXml(orderId)}</text>

    <!-- Meta Strip -->
    <rect x="32" y="204" width="510" height="80" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <rect x="565" y="204" width="510" height="80" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <rect x="1098" y="204" width="510" height="80" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />

    <text x="56" y="234" font-size="20" fill="#94a3b8" font-weight="600" letter-spacing="1.5">INVOICE NO</text>
    <text x="56" y="266" font-size="30" font-weight="700" fill="#0f172a">${escapeXml(orderId)}</text>

    <text x="589" y="234" font-size="20" fill="#94a3b8" font-weight="600" letter-spacing="1.5">DATE</text>
    <text x="589" y="266" font-size="30" font-weight="700" fill="#0f172a">${formattedDate}</text>

    <text x="1122" y="234" font-size="20" fill="#94a3b8" font-weight="600" letter-spacing="1.5">TOTAL ITEMS</text>
    <text x="1122" y="266" font-size="30" font-weight="700" fill="#0f172a">${totalQuantity}</text>

    <!-- From Card -->
    <rect x="32" y="312" width="770" height="180" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
    <text x="56" y="348" font-size="18" fill="#94a3b8" font-weight="600" letter-spacing="1.5">FROM</text>
    <line x1="56" y1="360" x2="780" y2="360" stroke="#e2e8f0" stroke-width="1" />
    <text x="56" y="398" font-size="28" font-weight="700" fill="#0f172a">Abhushan Gallery</text>
    <text x="56" y="436" font-size="25" fill="#475569">Kalimati, Kathmandu, Nepal</text>
    <text x="56" y="472" font-size="25" fill="#475569">Phone: 9861698400  |  Email: ${fromEmail}</text>

    <!-- Bill To Card -->
    <rect x="828" y="312" width="780" height="180" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
    <text x="852" y="348" font-size="18" fill="#94a3b8" font-weight="600" letter-spacing="1.5">BILL TO</text>
    <line x1="852" y1="360" x2="1584" y2="360" stroke="#e2e8f0" stroke-width="1" />
    <text x="852" y="398" font-size="28" font-weight="700" fill="#0f172a">${customerDisplayName}</text>
    ${billToTextElements}
    <text x="870" y="${billToBaseY}" font-size="25" fill="#475569">Phone: ${phone}  |  Email: ${email}</text>

    <!-- Table Header -->
    <rect x="32" y="${tableHeaderY}" width="1576" height="48" rx="8" fill="#1e3a5f" />
    <text x="52" y="${tableHeaderY + 32}" font-size="21" font-weight="600" fill="#ffffff" letter-spacing="0.8">#</text>
    <text x="160" y="${tableHeaderY + 32}" font-size="21" font-weight="600" fill="#ffffff" letter-spacing="0.8">ITEM DESCRIPTION</text>
    <text x="970" y="${tableHeaderY + 32}" font-size="21" font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="0.8">QTY</text>
    <text x="1260" y="${tableHeaderY + 32}" font-size="21" font-weight="600" fill="#ffffff" text-anchor="end" letter-spacing="0.8">UNIT PRICE</text>
    <text x="1588" y="${tableHeaderY + 32}" font-size="21" font-weight="600" fill="#ffffff" text-anchor="end" letter-spacing="0.8">AMOUNT</text>

    <!-- Product Rows -->
    <rect x="32" y="${tableHeaderY + 48}" width="1576" height="${Math.min(items.length, 8) * ROW_HEIGHT}" rx="0" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    ${productRows}

    <!-- Summary Box -->
    <rect x="1048" y="${summaryY}" width="560" height="${summaryHeight}" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    ${summaryTextElements}

    <!-- Footer -->
    <line x1="32" y1="${totalHeight - 42}" x2="1608" y2="${totalHeight - 42}" stroke="#e2e8f0" stroke-dasharray="6 4" />
    <text x="820" y="${totalHeight - 16}" font-size="24" fill="#94a3b8" text-anchor="middle">Thank you for shopping with Abhushan Gallery. This is a system-generated invoice.</text>
  </svg>`;
};

// ─── BUFFER GENERATORS ───────────────────────────────────────────────────────

const generateInvoiceSvgBuffer = (params) => Buffer.from(buildInvoiceSvg(params), 'utf8');

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
    ],
  });
};

const generateInvoicePngBuffer = async ({
  order,
  customerEmail,
  customerName,
  senderEmail,
  title,
}) => {
  let browser;
  try {
    browser = await _launchBrowser();
    if (!browser) {
      console.error('[invoice] Could not launch browser for PNG generation');
      return null;
    }
    const html = buildInvoiceHtml({ order, customerEmail, customerName, senderEmail, title });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 1600, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.waitForSelector('.sheet', { timeout: 5000 });

    const invoiceElement = await page.$('.sheet');
    if (!invoiceElement) {
      console.error('[invoice] .sheet element not found in rendered HTML');
      return null;
    }
    const raw = await invoiceElement.screenshot({ type: 'png' });
    return Buffer.from(raw);
  } catch (error) {
    console.error('[invoice] PNG generation failed:', error.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
};

const generateInvoicePngFromSvgBuffer = async ({
  order,
  customerEmail,
  customerName,
  senderEmail,
  title,
}) => {
  let browser;
  try {
    browser = await _launchBrowser();
    if (!browser) {
      console.error('[invoice] Could not launch browser for SVG->PNG generation');
      return null;
    }
    const svgMarkup = buildInvoiceSvg({ order, customerEmail, customerName, senderEmail, title });
    const page = await browser.newPage();
    await page.setViewport({ width: 1700, height: 2000, deviceScaleFactor: 2 });
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;display:flex;justify-content:center;padding:20px;">${svgMarkup}</body></html>`,
      { waitUntil: 'domcontentloaded', timeout: 15000 }
    );
    const svgElement = await page.$('svg');
    if (!svgElement) {
      console.error('[invoice] <svg> element not found in rendered SVG page');
      return null;
    }
    const raw = await svgElement.screenshot({ type: 'png' });
    return Buffer.from(raw);
  } catch (error) {
    console.error('[invoice] SVG->PNG generation failed:', error.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
};

module.exports = {
  buildInvoiceHtml,
  buildInvoiceSvg,
  generateInvoicePngBuffer,
  generateInvoicePngFromSvgBuffer,
  generateInvoiceSvgBuffer,
};
