const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../uploads/logo.png');

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
    await page.setViewport({ width: 980, height: 1400, deviceScaleFactor: 2 });
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

module.exports = {
  buildInvoiceHtml,
  generateInvoicePngBuffer,
};
