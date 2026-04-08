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

const buildInvoiceHtml = ({
  order,
  customerEmail,
  customerName,
  senderEmail,
  title = 'Invoice',
}) => {
  const orderId = order?.productOrderId || String(order?._id || '').slice(-8).toUpperCase();
  const orderDate = order?.OrderedAt
    ? new Date(order.OrderedAt)
    : new Date();

  const totalQuantity = (order?.products || []).reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0
  );
  const subtotal = (order?.products || []).reduce(
    (sum, item) => sum + Number(item?.price || 0),
    0
  );
  const shippingPrice = Number(order?.shippingPrice || 0);
  const giftBoxCharge = Number(order?.includeGiftBox ? 400 : order?.giftBoxCharge || 0);
  const totalAmount = Number(order?.totalAmount || subtotal + shippingPrice + giftBoxCharge);
  const logoDataUri = getLogoDataUri();

  const productRows = (order?.products || [])
    .map((product, index) => {
      const quantity = Number(product?.quantity || 1);
      const lineTotal = Number(product?.price || 0);
      const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${product?.productId?.name || 'Product'}</td>
          <td style="text-align:center;">${quantity}</td>
          <td style="text-align:right;">${formatCurrency(unitPrice)}</td>
          <td style="text-align:right;">${formatCurrency(lineTotal)}</td>
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
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #f3f4f6;
          color: #1f2937;
          font-family: Arial, Helvetica, sans-serif;
          padding: 24px;
        }
        .sheet {
          width: 900px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
          border-bottom: 1px solid #e5e7eb;
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }
        .logo {
          max-width: 170px;
          height: auto;
          display: block;
        }
        .title {
          text-align: right;
        }
        .title h1 {
          margin: 0;
          font-size: 30px;
          color: #111827;
        }
        .title p {
          margin: 8px 0 0;
          font-size: 13px;
          color: #4b5563;
        }
        .content {
          padding: 24px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .meta-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          background: #fafafa;
        }
        .meta-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
        .meta-value { margin-top: 6px; font-size: 14px; font-weight: 700; color: #111827; }
        .parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }
        .card {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px;
          background: #fff;
        }
        .card h3 {
          margin: 0 0 10px;
          font-size: 14px;
          color: #111827;
        }
        .card p {
          margin: 4px 0;
          font-size: 13px;
          color: #374151;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        th {
          background: #f9fafb;
          color: #374151;
          font-size: 12px;
          border: 1px solid #e5e7eb;
          padding: 10px;
          text-align: left;
        }
        td {
          border: 1px solid #e5e7eb;
          padding: 10px;
          font-size: 13px;
        }
        .summary {
          width: 320px;
          margin-left: auto;
          margin-top: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px;
          background: #fafafa;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          font-size: 13px;
        }
        .row.total {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #d1d5db;
          font-weight: 700;
          font-size: 15px;
        }
        .footer {
          margin-top: 22px;
          border-top: 1px dashed #d1d5db;
          padding-top: 12px;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div>
            ${logoDataUri ? `<img src="${logoDataUri}" class="logo" alt="Brand Logo" />` : ''}
          </div>
          <div class="title">
            <h1>${title}</h1>
            <p>Order #${orderId}</p>
          </div>
        </div>

        <div class="content">
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Invoice No</div>
              <div class="meta-value">${orderId}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Date</div>
              <div class="meta-value">${orderDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Items</div>
              <div class="meta-value">${totalQuantity}</div>
            </div>
          </div>

          <div class="parties">
            <div class="card">
              <h3>From</h3>
              <p>Kalimati, Kathmandu, Nepal</p>
              <p>Phone: 9861698400</p>
              <p>Email: ${senderEmail || 'support@store.com'}</p>
            </div>
            <div class="card">
              <h3>Bill To</h3>
              <p>${customerName || 'Valued Customer'}</p>
              <p>${order?.shippingLocation || ''}</p>
              <p>${order?.locationAddress || ''}</p>
              <p>Phone: ${order?.phoneNumber || 'N/A'}</p>
              <p>Email: ${customerEmail || 'N/A'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%;">#</th>
                <th style="width: 42%;">Item</th>
                <th style="width: 12%; text-align:center;">Qty</th>
                <th style="width: 19%; text-align:right;">Unit Price</th>
                <th style="width: 19%; text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
            </tbody>
          </table>

          <div class="summary">
            <div class="row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            <div class="row"><span>Shipping Fee</span><span>${formatCurrency(shippingPrice)}</span></div>
            <div class="row"><span>Gift Box Charge</span><span>${formatCurrency(giftBoxCharge)}</span></div>
            <div class="row total"><span>Total</span><span>${formatCurrency(totalAmount)}</span></div>
          </div>

          <div class="footer">
            Thank you for your order. This is a system-generated document.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

  const wrapText = (text, maxCharsPerLine = 52) => {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const words = raw.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (nextLine.length <= maxCharsPerLine) {
        currentLine = nextLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const billToAddress = [
    ...(wrapText(order?.shippingLocation || '', 48)),
    ...(wrapText(order?.locationAddress || '', 48)),
  ].slice(0, 2);

  const rows = items.slice(0, 6).map((item, index) => {
    const quantity = Number(item?.quantity || 1);
    const lineTotal = Number(item?.price || 0);
    const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;
    const yTop = 565 + (index * 48);
    const rowLineY = yTop + 48;

    return `
      <line x1="20" y1="${rowLineY}" x2="1580" y2="${rowLineY}" stroke="#e5e7eb" stroke-width="1" />
      <text x="34" y="${yTop + 30}" font-size="31" fill="#111827">${index + 1}</text>
      <text x="170" y="${yTop + 30}" font-size="31" fill="#111827">${escapeXml(item?.productId?.name || 'Product')}</text>
      <text x="980" y="${yTop + 30}" font-size="31" fill="#111827" text-anchor="middle">${quantity}</text>
      <text x="1265" y="${yTop + 30}" font-size="31" fill="#111827" text-anchor="end">${escapeXml(formatCurrency(unitPrice))}</text>
      <text x="1565" y="${yTop + 30}" font-size="31" fill="#111827" text-anchor="end">${escapeXml(formatCurrency(lineTotal))}</text>
    `;
  }).join('');

  const fromEmail = escapeXml(senderEmail || 'support@store.com');
  const line1 = billToAddress[0] ? `<text x="865" y="414" font-size="26" fill="#334155">${escapeXml(billToAddress[0])}</text>` : '';
  const line2 = billToAddress[1] ? `<text x="865" y="450" font-size="26" fill="#334155">${escapeXml(billToAddress[1])}</text>` : '';

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1640" height="1540" viewBox="0 0 1640 1540">
    <rect width="1640" height="1540" fill="#f1f3f7" />
    <rect x="1" y="1" width="1638" height="1538" rx="22" fill="#ffffff" stroke="#d7dbe3" stroke-width="2" />

    <rect x="2" y="2" width="1636" height="478" rx="20" fill="#e8edf4" />
    <rect x="2" y="240" width="1636" height="1" fill="#d7dbe3" />

    ${logoDataUri
      ? `<image href="${logoDataUri}" x="48" y="28" width="300" height="212" preserveAspectRatio="xMidYMid meet" />`
      : `<text x="52" y="125" font-size="42" font-weight="700" fill="#5b2a64">ABHUSHAN</text>
         <text x="52" y="168" font-size="36" font-weight="700" fill="#5b2a64">GALLERY</text>`}

    <text x="1090" y="150" font-size="66" font-weight="700" fill="#111827">${escapeXml(title)}</text>
    <text x="1090" y="202" font-size="31" fill="#4b5563">Order #${escapeXml(orderId)}</text>

    <rect x="32" y="286" width="510" height="96" rx="16" fill="#f9fafb" stroke="#d7dbe3" stroke-width="2" />
    <rect x="569" y="286" width="510" height="96" rx="16" fill="#f9fafb" stroke="#d7dbe3" stroke-width="2" />
    <rect x="1106" y="286" width="500" height="96" rx="16" fill="#f9fafb" stroke="#d7dbe3" stroke-width="2" />

    <text x="56" y="322" font-size="24" fill="#6b7280">INVOICE NO</text>
    <text x="56" y="360" font-size="37" font-weight="700" fill="#111827">${escapeXml(orderId)}</text>

    <text x="593" y="322" font-size="24" fill="#6b7280">DATE</text>
    <text x="593" y="360" font-size="37" font-weight="700" fill="#111827">${orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</text>

    <text x="1130" y="322" font-size="24" fill="#6b7280">ITEMS</text>
    <text x="1130" y="360" font-size="37" font-weight="700" fill="#111827">${totalQuantity}</text>

    <rect x="32" y="422" width="770" height="290" rx="16" fill="#ffffff" stroke="#d7dbe3" stroke-width="2" />
    <rect x="828" y="422" width="778" height="290" rx="16" fill="#ffffff" stroke="#d7dbe3" stroke-width="2" />

    <text x="56" y="474" font-size="42" font-weight="700" fill="#111827">From</text>
    <text x="56" y="528" font-size="33" fill="#334155">Kalimati, Kathmandu, Nepal</text>
    <text x="56" y="570" font-size="33" fill="#334155">Phone: 9861698400</text>
    <text x="56" y="612" font-size="33" fill="#334155">Email: ${fromEmail}</text>

    <text x="865" y="474" font-size="42" font-weight="700" fill="#111827">Bill To</text>
    <text x="865" y="528" font-size="33" fill="#334155">${escapeXml(customerName || 'Valued Customer')}</text>
    ${line1}
    ${line2}
    <text x="865" y="612" font-size="33" fill="#334155">Phone: ${escapeXml(order?.phoneNumber || 'N/A')}</text>
    <text x="865" y="652" font-size="33" fill="#334155">Email: ${escapeXml(customerEmail || 'N/A')}</text>

    <rect x="20" y="744" width="1600" height="64" fill="#f8fafc" stroke="#d7dbe3" stroke-width="2" />
    <text x="34" y="786" font-size="30" font-weight="700" fill="#374151">#</text>
    <text x="170" y="786" font-size="30" font-weight="700" fill="#374151">Item</text>
    <text x="980" y="786" font-size="30" font-weight="700" fill="#374151" text-anchor="middle">Qty</text>
    <text x="1265" y="786" font-size="30" font-weight="700" fill="#374151" text-anchor="end">Unit Price</text>
    <text x="1565" y="786" font-size="30" font-weight="700" fill="#374151" text-anchor="end">Amount</text>

    <line x1="20" y1="856" x2="1580" y2="856" stroke="#e5e7eb" stroke-width="1" />
    ${rows}

    <rect x="1028" y="1042" width="578" height="236" rx="16" fill="#f9fafb" stroke="#d7dbe3" stroke-width="2" />
    <text x="1050" y="1090" font-size="38" fill="#374151">Subtotal</text>
    <text x="1578" y="1090" font-size="38" fill="#374151" text-anchor="end">${escapeXml(formatCurrency(subtotal))}</text>
    <text x="1050" y="1140" font-size="38" fill="#374151">Shipping Fee</text>
    <text x="1578" y="1140" font-size="38" fill="#374151" text-anchor="end">${escapeXml(formatCurrency(shippingPrice))}</text>
    <text x="1050" y="1190" font-size="38" fill="#374151">Gift Box Charge</text>
    <text x="1578" y="1190" font-size="38" fill="#374151" text-anchor="end">${escapeXml(formatCurrency(giftBoxCharge))}</text>
    <line x1="1042" y1="1212" x2="1580" y2="1212" stroke="#d1d5db" stroke-width="2" />
    <text x="1050" y="1262" font-size="48" font-weight="700" fill="#111827">Total</text>
    <text x="1578" y="1262" font-size="48" font-weight="700" fill="#111827" text-anchor="end">${escapeXml(formatCurrency(totalAmount))}</text>

    <line x1="20" y1="1446" x2="1620" y2="1446" stroke="#d1d5db" stroke-dasharray="8 6" />
    <text x="820" y="1490" font-size="30" fill="#6b7280" text-anchor="middle">Thank you for your order. This is a system-generated document.</text>
  </svg>`;
};

const generateInvoiceSvgBuffer = (params) => Buffer.from(buildInvoiceSvg(params), 'utf8');

const generateInvoicePngBuffer = async ({
  order,
  customerEmail,
  customerName,
  senderEmail,
  title,
}) => {
  let browser;

  try {
    // Lazy-load to avoid hard crash if dependency is not installed yet.
    const puppeteer = require('puppeteer');
    const html = buildInvoiceHtml({
      order,
      customerEmail,
      customerName,
      senderEmail,
      title,
    });

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1520, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const invoiceElement = await page.$('.sheet');
    if (!invoiceElement) {
      return null;
    }

    return await invoiceElement.screenshot({ type: 'png' });
  } catch (error) {
    console.error('Failed to generate invoice PNG:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
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
    const puppeteer = require('puppeteer');
    const svgMarkup = buildInvoiceSvg({
      order,
      customerEmail,
      customerName,
      senderEmail,
      title,
    });

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1640, height: 1540, deviceScaleFactor: 2 });
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:#fff;">${svgMarkup}</body></html>`,
      { waitUntil: 'networkidle0' }
    );

    const svgElement = await page.$('svg');
    if (!svgElement) {
      return null;
    }

    return await svgElement.screenshot({ type: 'png' });
  } catch (error) {
    console.error('Failed to generate PNG from SVG invoice:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
};

module.exports = {
  buildInvoiceHtml,
  generateInvoicePngBuffer,
  generateInvoicePngFromSvgBuffer,
  generateInvoiceSvgBuffer,
};
