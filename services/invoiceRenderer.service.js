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

const getPaymentMethodLabel = (method) => {
  const labels = {
    esewa: 'eSewa',
    khalti: 'Khalti',
    cod: 'Cash on Delivery',
    stripe: 'Stripe',
    bank: 'Bank Transfer',
    ime: 'IME Pay',
    npay: 'NPay',
  };
  return labels[String(method || '').toLowerCase()] || method || 'N/A';
};

const getPaymentStatus = (order) => {
  const method = String(order?.paymentMethod || '').toLowerCase();
  if (method === 'cod') return 'Pending';
  return 'Paid';
};

const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatDateTime = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  const formattedDate = formatDate(orderDate);
  const paymentMethod = getPaymentMethodLabel(order?.paymentMethod);
  const paymentStatus = getPaymentStatus(order);
  const isPaid = paymentStatus === 'Paid';

  const deliveryType = order?.isHomeDelivery ? 'Home Delivery' : 'Store Pickup';
  const deliveryZone = order?.isInsideValley ? 'Inside Valley' : 'Outside Valley';
  const deliveryArea = order?.isRedZone ? 'Red Zone' : 'Standard Zone';
  const deliveryPartner = order?.deliveryPartner || 'To be assigned';
  const deliveryTime = order?.deliveryTimeMessage || 'To be confirmed';

  const productRows = (order?.products || [])
    .map((product, index) => {
      const quantity = Number(product?.quantity || 1);
      const lineTotal = Number(product?.price || 0);
      const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;
      const itemName = truncate(product?.productId?.name || 'Product', 36);
      const colorName = product?.colorName || '-';
      const isEven = index % 2 === 0;

      return `
        <tr style="background: ${isEven ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 11px 14px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #94a3b8; width: 4%; vertical-align: middle;">${index + 1}</td>
          <td style="padding: 11px 14px; border-bottom: 1px solid #e5e7eb; font-size: 12.5px; color: #0f172a; font-weight: 500; width: 36%; vertical-align: middle; word-break: break-word;">${itemName}</td>
          <td style="padding: 11px 14px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #64748b; width: 12%; vertical-align: middle;">${colorName}</td>
          <td style="padding: 11px 14px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #475569; width: 8%; text-align: center; vertical-align: middle;">${quantity}</td>
          <td style="padding: 11px 14px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #475569; width: 18%; text-align: right; vertical-align: middle;">${formatCurrency(unitPrice)}</td>
          <td style="padding: 11px 14px; border-bottom: 1px solid #e5e7eb; font-size: 12.5px; color: #0f172a; font-weight: 600; width: 22%; text-align: right; vertical-align: middle;">${formatCurrency(lineTotal)}</td>
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #e2e8f0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1e293b;
          padding: 24px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .sheet {
          width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.06);
          position: relative;
        }

        /* ── HEADER ── */
        .header {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #2563eb 100%);
          padding: 28px 36px 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -60px;
          right: -60px;
          width: 200px;
          height: 200px;
          background: rgba(255,255,255,0.03);
          border-radius: 50%;
        }
        .header::after {
          content: '';
          position: absolute;
          bottom: -40px;
          left: 30%;
          width: 120px;
          height: 120px;
          background: rgba(255,255,255,0.02);
          border-radius: 50%;
        }
        .logo-wrap { display: flex; align-items: center; gap: 14px; }
        .logo { max-width: 52px; height: auto; display: block; filter: brightness(0) invert(1); }
        .brand-text h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.5px;
        }
        .brand-text p {
          margin: 2px 0 0;
          font-size: 10.5px;
          color: rgba(255,255,255,0.55);
          font-weight: 400;
          letter-spacing: 0.3px;
        }
        .header-right { text-align: right; position: relative; z-index: 1; }
        .header-right h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 3px;
          text-transform: uppercase;
          line-height: 1;
        }
        .header-right .order-id {
          margin: 6px 0 0;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          font-weight: 400;
          letter-spacing: 0.5px;
        }

        /* ── META STRIP ── */
        .meta-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #e2e8f0;
        }
        .meta-cell {
          padding: 14px 20px;
          border-right: 1px solid #f1f5f9;
        }
        .meta-cell:last-child { border-right: none; }
        .meta-label {
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #94a3b8;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .meta-value {
          font-size: 12.5px;
          font-weight: 600;
          color: #0f172a;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .status-paid {
          background: #dcfce7;
          color: #166534;
        }
        .status-pending {
          background: #fef3c7;
          color: #92400e;
        }

        /* ── CONTENT ── */
        .content { padding: 22px 36px 20px; }

        /* ── PARTIES ── */
        .parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        .party-card {
          background: #f8fafc;
          border-radius: 6px;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
        }
        .party-card h3 {
          margin: 0 0 8px;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #64748b;
          font-weight: 700;
          padding-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
        }
        .party-card p {
          margin: 3px 0;
          font-size: 11.5px;
          color: #475569;
          line-height: 1.5;
        }
        .party-card .name {
          font-weight: 600;
          color: #0f172a;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .party-card .detail-label {
          font-weight: 500;
          color: #64748b;
          font-size: 10.5px;
        }

        /* ── TABLE ── */
        .items-section { margin-bottom: 18px; }
        .items-section h3 {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #94a3b8;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .items-table thead th {
          background: #0f172a;
          color: #ffffff;
          font-size: 9.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 10px 14px;
          text-align: left;
          border: none;
        }
        .items-table thead th.num { text-align: center; }
        .items-table thead th.right { text-align: right; }

        /* ── SUMMARY + INFO ── */
        .bottom-section {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 16px;
          margin-bottom: 16px;
        }
        .info-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
        }
        .info-card h4 {
          margin: 0 0 6px;
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #94a3b8;
          font-weight: 700;
        }
        .info-card p {
          margin: 2px 0;
          font-size: 11px;
          color: #475569;
          line-height: 1.5;
        }
        .info-card .info-value {
          font-weight: 500;
          color: #1e293b;
        }

        .summary {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 14px 16px;
          align-self: flex-start;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          font-size: 12px;
          color: #64748b;
        }
        .summary-row .label { font-weight: 400; }
        .summary-row .value { font-weight: 500; color: #334155; }
        .summary-row.total {
          margin-top: 8px;
          padding-top: 10px;
          border-top: 2px solid #0f172a;
          font-size: 14px;
        }
        .summary-row.total .label {
          font-weight: 700;
          color: #0f172a;
        }
        .summary-row.total .value {
          font-weight: 800;
          color: #2563eb;
          font-size: 15px;
        }

        /* ── ORDER NOTE ── */
        .order-note {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 16px;
        }
        .order-note h4 {
          margin: 0 0 4px;
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #92400e;
          font-weight: 700;
        }
        .order-note p {
          margin: 0;
          font-size: 11px;
          color: #78350f;
          line-height: 1.5;
        }

        /* ── FOOTER ── */
        .footer {
          text-align: center;
          padding: 14px 36px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          position: relative;
        }
        .footer-divider {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, #2563eb, #1e3a5f);
          margin: 0 auto 10px;
          border-radius: 1px;
        }
        .footer p {
          margin: 2px 0;
          font-size: 9.5px;
          color: #94a3b8;
          line-height: 1.5;
        }
        .footer .brand {
          font-weight: 600;
          color: #64748b;
          font-size: 10px;
        }
        .footer .website {
          color: #2563eb;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <!-- Header -->
        <div class="header">
          <div class="logo-wrap">
            ${logoDataUri ? `<img src="${logoDataUri}" class="logo" alt="Abhushan Gallery" />` : ''}
            <div class="brand-text">
              <h2>Abhushan Gallery</h2>
              <p>Kalimati, Kathmandu, Nepal</p>
            </div>
          </div>
          <div class="header-right">
            <h1>${title}</h1>
            <p class="order-id">Order #${orderId}</p>
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
            <div class="meta-label">Payment Method</div>
            <div class="meta-value">${paymentMethod}</div>
          </div>
          <div class="meta-cell">
            <div class="meta-label">Status</div>
            <div class="meta-value">
              <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">${paymentStatus}</span>
            </div>
          </div>
        </div>

        <div class="content">
          <!-- Parties -->
          <div class="parties">
            <div class="party-card">
              <h3>From</h3>
              <p class="name">Abhushan Gallery</p>
              <p>Kalimati, Kathmandu, Nepal</p>
              <p><span class="detail-label">Phone:</span> +977 9861698400</p>
              <p><span class="detail-label">Email:</span> ${senderEmail || 'support@abhushangallery.com'}</p>
              <p><span class="detail-label">Web:</span> abhushangallery.com</p>
            </div>
            <div class="party-card">
              <h3>Bill To</h3>
              <p class="name">${customerName || order?.fullName || 'Valued Customer'}</p>
              ${order?.shippingLocation ? `<p>${order.shippingLocation}</p>` : ''}
              ${order?.locationAddress ? `<p>${order.locationAddress}</p>` : ''}
              <p><span class="detail-label">Phone:</span> ${order?.phoneNumber || 'N/A'}</p>
              ${customerEmail ? `<p><span class="detail-label">Email:</span> ${customerEmail}</p>` : ''}
            </div>
          </div>

          <!-- Items Table -->
          <div class="items-section">
            <h3>Order Items</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 4%;">#</th>
                  <th style="width: 36%;">Description</th>
                  <th style="width: 12%;">Color</th>
                  <th class="num" style="width: 8%;">Qty</th>
                  <th class="right" style="width: 18%;">Unit Price</th>
                  <th class="right" style="width: 22%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>
          </div>

          <!-- Bottom Section -->
          <div class="bottom-section">
            <div class="info-cards">
              <!-- Delivery Info -->
              <div class="info-card">
                <h4>Delivery Information</h4>
                <p><span class="info-value">${deliveryType}</span> &middot; ${deliveryZone} &middot; ${deliveryArea}</p>
                <p><span class="detail-label">Partner:</span> <span class="info-value">${deliveryPartner}</span></p>
                <p><span class="detail-label">Est. Delivery:</span> <span class="info-value">${deliveryTime}</span></p>
                ${order?.shippingLocation ? `<p><span class="detail-label">Ship To:</span> <span class="info-value">${order.shippingLocation}</span></p>` : ''}
              </div>

              ${order?.orderNote ? `
              <!-- Order Note -->
              <div class="order-note">
                <h4>Order Note</h4>
                <p>${order.orderNote}</p>
              </div>
              ` : ''}
            </div>

            <!-- Summary -->
            <div class="summary">
              <div class="summary-row">
                <span class="label">Subtotal (${totalQuantity} items)</span>
                <span class="value">${formatCurrency(subtotal)}</span>
              </div>
              <div class="summary-row">
                <span class="label">Shipping Fee</span>
                <span class="value">${formatCurrency(shippingPrice)}</span>
              </div>
              ${giftBoxCharge > 0 ? `
              <div class="summary-row">
                <span class="label">Gift Box</span>
                <span class="value">${formatCurrency(giftBoxCharge)}</span>
              </div>
              ` : ''}
              <div class="summary-row total">
                <span class="label">Total</span>
                <span class="value">${formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-divider"></div>
          <p class="brand">Abhushan Gallery</p>
          <p>Kalimati, Kathmandu, Nepal &middot; +977 9861698400 &middot; <span class="website">abhushangallery.com</span></p>
          <p style="margin-top: 6px; font-size: 9px; color: #cbd5e1;">This is a system-generated invoice. For any queries, please contact support@abhushangallery.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ─── SVG INVOICE ─────────────────────────────────────────────────────────────

const buildInvoiceSvg = ({ order, customerEmail, customerName, senderEmail, title = 'Invoice' }) => {
  const orderId = order?.productOrderId || String(order?._id || '').slice(-8).toUpperCase();
  const orderDate = order?.OrderedAt ? new Date(order.OrderedAt) : new Date();
  const items = order?.products || [];
  const logoDataUri = getLogoDataUri();

  const totalQuantity = items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item?.price || 0), 0);
  const shippingPrice = Number(order?.shippingPrice || 0);
  const giftBoxCharge = Number(order?.includeGiftBox ? 400 : order?.giftBoxCharge || 0);
  const totalAmount = Number(order?.totalAmount || subtotal + shippingPrice + giftBoxCharge);

  const formattedDate = formatDate(orderDate);
  const paymentMethod = getPaymentMethodLabel(order?.paymentMethod);
  const paymentStatus = getPaymentStatus(order);
  const isPaid = paymentStatus === 'Paid';

  const deliveryType = order?.isHomeDelivery ? 'Home Delivery' : 'Store Pickup';
  const deliveryZone = order?.isInsideValley ? 'Inside Valley' : 'Outside Valley';
  const deliveryPartner = order?.deliveryPartner || 'To be assigned';
  const deliveryTime = order?.deliveryTimeMessage || 'To be confirmed';

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
  const customerDisplayName = escapeXml(truncate(customerName || order?.fullName || 'Valued Customer', 30));
  const phone = escapeXml(order?.phoneNumber || 'N/A');
  const email = escapeXml(truncate(customerEmail || '', 30));

  const billToLines = [
    ...wrapText(order?.shippingLocation || '', 44),
    ...wrapText(order?.locationAddress || '', 44),
  ].slice(0, 3);

  const billToTextElements = billToLines.map((line, i) =>
    `<text x="870" y="${500 + i * 36}" font-size="26" fill="#475569">${escapeXml(truncate(line, 44))}</text>`
  ).join('\n    ');

  const billToBaseY = 500 + billToLines.length * 36;

  const tableHeaderY = Math.max(billToBaseY + 56, 680);

  const ROW_HEIGHT = 44;
  const productRows = items.slice(0, 8).map((item, index) => {
    const quantity = Number(item?.quantity || 1);
    const lineTotal = Number(item?.price || 0);
    const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;
    const y = tableHeaderY + 48 + index * ROW_HEIGHT;
    const itemName = truncate(item?.productId?.name || 'Product', 38);
    const colorName = escapeXml(truncate(item?.colorName || '-', 12));
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <rect x="32" y="${y - 6}" width="1576" height="${ROW_HEIGHT}" fill="${bgColor}" />
      <line x1="32" y1="${y + ROW_HEIGHT - 6}" x2="1608" y2="${y + ROW_HEIGHT - 6}" stroke="#e5e7eb" stroke-width="1" />
      <text x="52" y="${y + 24}" font-size="25" fill="#94a3b8">${index + 1}</text>
      <text x="120" y="${y + 24}" font-size="25" fill="#0f172a" font-weight="500">${escapeXml(itemName)}</text>
      <text x="740" y="${y + 24}" font-size="24" fill="#64748b">${colorName}</text>
      <text x="970" y="${y + 24}" font-size="24" fill="#475569" text-anchor="middle">${quantity}</text>
      <text x="1260" y="${y + 24}" font-size="24" fill="#475569" text-anchor="end">${escapeXml(formatCurrency(unitPrice))}</text>
      <text x="1588" y="${y + 24}" font-size="24" fill="#0f172a" font-weight="600" text-anchor="end">${escapeXml(formatCurrency(lineTotal))}</text>
    `;
  }).join('');

  const tableBottom = tableHeaderY + 48 + Math.min(items.length, 8) * ROW_HEIGHT;

  // Delivery info section
  const deliveryInfoY = tableBottom + 32;
  const deliveryInfoLines = [
    `${deliveryType}  ·  ${deliveryZone}`,
    `Partner: ${deliveryPartner}  ·  ETA: ${deliveryTime}`,
  ];
  const deliveryInfoElements = deliveryInfoLines.map((line, i) =>
    `<text x="52" y="${deliveryInfoY + 32 + i * 32}" font-size="24" fill="#475569">${escapeXml(truncate(line, 70))}</text>`
  ).join('\n    ');

  const summaryY = deliveryInfoY + 110;
  const summaryLines = [
    { label: `Subtotal (${totalQuantity} items)`, value: formatCurrency(subtotal), bold: false },
    { label: 'Shipping Fee', value: formatCurrency(shippingPrice), bold: false },
  ];
  if (giftBoxCharge > 0) {
    summaryLines.push({ label: 'Gift Box', value: formatCurrency(giftBoxCharge), bold: false });
  }
  summaryLines.push({ label: 'Total', value: formatCurrency(totalAmount), bold: true });

  const summaryHeight = 24 + summaryLines.length * 42 + 20;

  const summaryTextElements = summaryLines.map((line, i) => {
    const y = summaryY + 32 + i * 42;
    if (line.bold) {
      return `
        <line x1="1068" y1="${y - 10}" x2="1600" y2="${y - 10}" stroke="#0f172a" stroke-width="2" />
        <text x="1080" y="${y + 10}" font-size="30" font-weight="700" fill="#0f172a">${line.label}</text>
        <text x="1588" y="${y + 10}" font-size="30" font-weight="800" fill="#2563eb" text-anchor="end">${escapeXml(line.value)}</text>
      `;
    }
    return `
      <text x="1080" y="${y + 10}" font-size="26" fill="#64748b">${line.label}</text>
      <text x="1588" y="${y + 10}" font-size="26" fill="#334155" font-weight="500" text-anchor="end">${escapeXml(line.value)}</text>
    `;
  }).join('\n    ');

  const totalHeight = summaryY + summaryHeight + 80;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1640" height="${totalHeight}" viewBox="0 0 1640 ${totalHeight}">
    <!-- Background -->
    <rect width="1640" height="${totalHeight}" fill="#e2e8f0" />
    <rect x="1" y="1" width="1638" height="${totalHeight - 2}" rx="6" fill="#ffffff" />

    <!-- Header -->
    <defs>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="40%" stop-color="#1e3a5f" />
        <stop offset="100%" stop-color="#2563eb" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="1636" height="160" rx="5" fill="url(#headerGrad)" />

    ${logoDataUri
      ? `<image href="${logoDataUri}" x="44" y="28" width="60" height="60" preserveAspectRatio="xMidYMid meet" />`
      : `<text x="52" y="80" font-size="36" font-weight="700" fill="#ffffff">AG</text>`}
    <text x="120" y="64" font-size="30" font-weight="700" fill="#ffffff">Abhushan Gallery</text>
    <text x="120" y="96" font-size="20" fill="rgba(255,255,255,0.5)">Kalimati, Kathmandu, Nepal</text>

    <text x="1588" y="72" font-size="44" font-weight="800" fill="#ffffff" text-anchor="end" letter-spacing="3">${escapeXml(title)}</text>
    <text x="1588" y="108" font-size="22" fill="rgba(255,255,255,0.5)" text-anchor="end">Order #${escapeXml(orderId)}</text>

    <!-- Meta Strip -->
    <rect x="32" y="184" width="380" height="72" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <rect x="428" y="184" width="380" height="72" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <rect x="824" y="184" width="380" height="72" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <rect x="1220" y="184" width="388" height="72" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />

    <text x="52" y="210" font-size="17" fill="#94a3b8" font-weight="600" letter-spacing="1.5">INVOICE NO</text>
    <text x="52" y="240" font-size="26" font-weight="700" fill="#0f172a">${escapeXml(orderId)}</text>

    <text x="448" y="210" font-size="17" fill="#94a3b8" font-weight="600" letter-spacing="1.5">DATE</text>
    <text x="448" y="240" font-size="26" font-weight="700" fill="#0f172a">${formattedDate}</text>

    <text x="844" y="210" font-size="17" fill="#94a3b8" font-weight="600" letter-spacing="1.5">PAYMENT</text>
    <text x="844" y="240" font-size="26" font-weight="600" fill="#0f172a">${escapeXml(paymentMethod)}</text>

    <text x="1240" y="210" font-size="17" fill="#94a3b8" font-weight="600" letter-spacing="1.5">STATUS</text>
    <rect x="1240" y="220" width="${isPaid ? 64 : 88}" height="26" rx="5" fill="${isPaid ? '#dcfce7' : '#fef3c7'}" />
    <text x="1252" y="239" font-size="18" font-weight="600" fill="${isPaid ? '#166534' : '#92400e'}">${paymentStatus}</text>

    <!-- From Card -->
    <rect x="32" y="276" width="770" height="176" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
    <text x="56" y="306" font-size="16" fill="#94a3b8" font-weight="700" letter-spacing="1.5">FROM</text>
    <line x1="56" y1="316" x2="780" y2="316" stroke="#e2e8f0" stroke-width="1" />
    <text x="56" y="348" font-size="26" font-weight="700" fill="#0f172a">Abhushan Gallery</text>
    <text x="56" y="382" font-size="23" fill="#475569">Kalimati, Kathmandu, Nepal</text>
    <text x="56" y="414" font-size="22" fill="#475569">Phone: +977 9861698400</text>
    <text x="56" y="440" font-size="22" fill="#475569">Email: ${fromEmail}</text>

    <!-- Bill To Card -->
    <rect x="828" y="276" width="780" height="176" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
    <text x="852" y="306" font-size="16" fill="#94a3b8" font-weight="700" letter-spacing="1.5">BILL TO</text>
    <line x1="852" y1="316" x2="1584" y2="316" stroke="#e2e8f0" stroke-width="1" />
    <text x="852" y="348" font-size="26" font-weight="700" fill="#0f172a">${customerDisplayName}</text>
    ${billToTextElements}
    <text x="870" y="${billToBaseY}" font-size="22" fill="#475569">Phone: ${phone}  |  Email: ${email}</text>

    <!-- Table Header -->
    <rect x="32" y="${tableHeaderY}" width="1576" height="44" rx="6" fill="#0f172a" />
    <text x="52" y="${tableHeaderY + 28}" font-size="19" font-weight="600" fill="#ffffff" letter-spacing="0.8">#</text>
    <text x="120" y="${tableHeaderY + 28}" font-size="19" font-weight="600" fill="#ffffff" letter-spacing="0.8">DESCRIPTION</text>
    <text x="740" y="${tableHeaderY + 28}" font-size="19" font-weight="600" fill="#ffffff" letter-spacing="0.8">COLOR</text>
    <text x="970" y="${tableHeaderY + 28}" font-size="19" font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="0.8">QTY</text>
    <text x="1260" y="${tableHeaderY + 28}" font-size="19" font-weight="600" fill="#ffffff" text-anchor="end" letter-spacing="0.8">UNIT PRICE</text>
    <text x="1588" y="${tableHeaderY + 28}" font-size="19" font-weight="600" fill="#ffffff" text-anchor="end" letter-spacing="0.8">AMOUNT</text>

    <!-- Product Rows -->
    <rect x="32" y="${tableHeaderY + 44}" width="1576" height="${Math.min(items.length, 8) * ROW_HEIGHT}" rx="0" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    ${productRows}

    <!-- Delivery Info -->
    <rect x="32" y="${deliveryInfoY}" width="980" height="80" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <text x="52" y="${deliveryInfoY + 24}" font-size="16" fill="#94a3b8" font-weight="700" letter-spacing="1.5">DELIVERY INFORMATION</text>
    ${deliveryInfoElements}

    <!-- Summary Box -->
    <rect x="1048" y="${summaryY}" width="560" height="${summaryHeight}" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    ${summaryTextElements}

    <!-- Footer -->
    <line x1="32" y1="${totalHeight - 48}" x2="1608" y2="${totalHeight - 48}" stroke="#e2e8f0" stroke-dasharray="6 4" />
    <text x="820" y="${totalHeight - 26}" font-size="22" fill="#94a3b8" text-anchor="middle" font-weight="600">Abhushan Gallery</text>
    <text x="820" y="${totalHeight - 6}" font-size="18" fill="#cbd5e1" text-anchor="middle">Kalimati, Kathmandu, Nepal · +977 9861698400 · abhushangallery.com</text>
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
    await page.setViewport({ width: 842, height: 1190, deviceScaleFactor: 3 });
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
      `<!DOCTYPE html><html><body style="margin:0;background:#e2e8f0;display:flex;justify-content:center;padding:20px;">${svgMarkup}</body></html>`,
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
