require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { EMAIL_CONFIG, transporter, buildCommonHeaders } = require('./mailConfig');
const { Product } = require("../modals/product.modal");
const {
  generateInvoicePngBuffer,
  generateInvoicePngFromSvgBuffer,
} = require('./invoiceRenderer.service');

const formatCurrency = (value) => `NPR ${Number(value || 0).toFixed(2)}`;

const buildFooterHtml = () => `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;">
    <p style="margin:0;">Aabhushan Gallery | Kalimati, Kathmandu, Nepal</p>
    <p style="margin:4px 0 0;">Phone: 9861698400 | Email: ${EMAIL_CONFIG.sender}</p>
    <p style="margin:8px 0 0;">&copy; ${new Date().getFullYear()} Aabhushan Gallery. All rights reserved.</p>
  </div>
`;

const buildFooterText = () => `
---
Aabhushan Gallery | Kalimati, Kathmandu, Nepal
Phone: 9861698400 | Email: ${EMAIL_CONFIG.sender}
(c) ${new Date().getFullYear()} Aabhushan Gallery. All rights reserved.
`;

const sendOutOfStockNotification = async (newOutOfStockProducts) => {
  try {
    const allOutOfStockProducts = await Product.find({
      stockQuantity: 0
    }).populate('category').populate('subCategory');

    console.log('allout of stock products:', allOutOfStockProducts);

    const subject = `Product Out of Stock Alert - ${newOutOfStockProducts.length} New Product(s) Out of Stock`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="padding:28px 12px;">
          <div style="max-width:760px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;">
            <div style="padding:24px 22px 16px;background:linear-gradient(135deg,#fef2f2 0%,#fff1f2 100%);text-align:center;border-bottom:1px solid #fecaca;">
              <h1 style="margin:0;font-size:22px;color:#991b1b;">Product Out of Stock Alert</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#6b7280;">Dear Admin,</p>
            </div>
            <div style="padding:24px 22px;">
              <div style="margin-bottom:24px;">
                <h2 style="margin:0 0 12px;font-size:18px;color:#991b1b;border-bottom:2px solid #fecaca;padding-bottom:8px;">
                  Newly Out of Stock (${newOutOfStockProducts.length})
                </h2>
                <div style="background-color:#fef2f2;padding:16px;border-radius:8px;border-left:4px solid #dc2626;">
                  ${newOutOfStockProducts.map(product => `
                    <div style="padding:12px;border-bottom:1px solid #fecdd3;margin-bottom:10px;">
                      <h3 style="margin:0 0 6px;color:#991b1b;font-size:16px;">${product.name}</h3>
                      <p style="margin:2px 0;font-size:13px;"><strong>Previous Stock:</strong> ${product.previousStock} units</p>
                      <p style="margin:2px 0;font-size:13px;"><strong>Ordered Quantity:</strong> ${product.orderedQuantity} units</p>
                      <p style="margin:2px 0;font-size:13px;"><strong>Price:</strong> NPR ${product.price || 'N/A'}</p>
                      <p style="margin:2px 0;font-size:13px;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div style="margin-bottom:24px;">
                <h2 style="margin:0 0 12px;font-size:18px;color:#c2410c;border-bottom:2px solid #fed7aa;padding-bottom:8px;">
                  Complete Out of Stock Inventory (${allOutOfStockProducts.length})
                </h2>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                  <thead>
                    <tr style="background:#fff7ed;">
                      <th style="padding:10px;text-align:left;border-bottom:2px solid #fed7aa;">Product</th>
                      <th style="padding:10px;text-align:left;border-bottom:2px solid #fed7aa;">Category</th>
                      <th style="padding:10px;text-align:center;border-bottom:2px solid #fed7aa;">Sales</th>
                      <th style="padding:10px;text-align:left;border-bottom:2px solid #fed7aa;">Last Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allOutOfStockProducts.map(p => `
                      <tr style="border-bottom:1px solid #fed7aa;">
                        <td style="padding:10px;font-weight:600;">${p.name}</td>
                        <td style="padding:10px;">${p.category?.name || 'N/A'}</td>
                        <td style="padding:10px;text-align:center;">${p.totalSales || 0}</td>
                        <td style="padding:10px;">${p.lastSoldAt ? new Date(p.lastSoldAt).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                ${allOutOfStockProducts.length === 0 ? '<p style="text-align:center;color:#16a34a;padding:20px;font-weight:600;">All products are in stock.</p>' : ''}
              </div>

              <div style="background:#f0fdf4;padding:16px;border-radius:8px;border-left:4px solid #22c55e;margin-bottom:16px;">
                <h3 style="margin:0 0 8px;color:#166534;font-size:15px;">Summary</h3>
                <p style="margin:2px 0;font-size:13px;"><strong>New Out of Stock:</strong> ${newOutOfStockProducts.length} product(s)</p>
                <p style="margin:2px 0;font-size:13px;"><strong>Total Out of Stock:</strong> ${allOutOfStockProducts.length} product(s)</p>
                <p style="margin:2px 0;font-size:13px;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <p style="font-size:14px;line-height:1.6;color:#374151;">Please review and restock these products to avoid lost sales.</p>
            </div>
            ${buildFooterHtml()}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Product Out of Stock Alert

Dear Admin,

Newly Out of Stock (${newOutOfStockProducts.length}):
${newOutOfStockProducts.map(p => `- ${p.name}: ${p.previousStock} units -> 0 (ordered ${p.orderedQuantity})`).join('\n')}

Total Out of Stock: ${allOutOfStockProducts.length} products
Time: ${new Date().toLocaleString()}

Please restock these products.
${buildFooterText()}`;

    const headers = buildCommonHeaders({ to: EMAIL_CONFIG.adminRecipients, subject });

    await transporter.sendMail({
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: EMAIL_CONFIG.adminRecipients,
      subject,
      html,
      text,
      headers,
      replyTo: EMAIL_CONFIG.sender,
    });
    console.log(`Out-of-stock notification sent for ${newOutOfStockProducts.length} new products. Total out of stock: ${allOutOfStockProducts.length}`);

    return true;
  } catch (error) {
    console.error('Error sending out-of-stock notification:', error);
    return false;
  }
};

const sendCompleteOutOfStockReport = async () => {
  try {
    const allOutOfStockProducts = await Product.find({
      stockQuantity: 0
    })
    .populate('category')
    .populate('subCategory')
    .sort({ totalSales: -1, lastSoldAt: -1 });

    const subject = `Complete Out of Stock Report - ${allOutOfStockProducts.length} Products`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="padding:28px 12px;">
          <div style="max-width:760px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;">
            <div style="padding:24px 22px 16px;background:linear-gradient(135deg,#fff7ed 0%,#fef3c7 100%);text-align:center;border-bottom:1px solid #fed7aa;">
              <h1 style="margin:0;font-size:22px;color:#c2410c;">Out of Stock Inventory Report</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#6b7280;">Dear Admin,</p>
            </div>
            <div style="padding:24px 22px;">
              <p style="font-size:14px;line-height:1.6;color:#374151;">Here is the complete list of all products currently out of stock:</p>

              <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
                <thead>
                  <tr style="background:#fff7ed;">
                    <th style="padding:10px;text-align:left;border-bottom:2px solid #fed7aa;">Product</th>
                    <th style="padding:10px;text-align:left;border-bottom:2px solid #fed7aa;">Category</th>
                    <th style="padding:10px;text-align:center;border-bottom:2px solid #fed7aa;">Sales</th>
                    <th style="padding:10px;text-align:left;border-bottom:2px solid #fed7aa;">Last Sold</th>
                  </tr>
                </thead>
                <tbody>
                  ${allOutOfStockProducts.map((p, i) => `
                    <tr style="${i % 2 === 0 ? 'background:#fffbeb;' : 'background:#fff;'}border-bottom:1px solid #fed7aa;">
                      <td style="padding:10px;font-weight:600;">${p.name}</td>
                      <td style="padding:10px;">${p.category?.name || 'N/A'}</td>
                      <td style="padding:10px;text-align:center;">${p.totalSales || 0}</td>
                      <td style="padding:10px;">${p.lastSoldAt ? new Date(p.lastSoldAt).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${allOutOfStockProducts.length === 0 ? '<p style="text-align:center;color:#16a34a;padding:20px;font-weight:600;">All products are in stock.</p>' : ''}

              <div style="background:#eff6ff;padding:16px;border-radius:8px;border-left:4px solid #3b82f6;margin:16px 0;">
                <h3 style="margin:0 0 8px;color:#1e40af;font-size:15px;">Summary</h3>
                <p style="margin:2px 0;font-size:13px;"><strong>Total Out of Stock:</strong> ${allOutOfStockProducts.length}</p>
                <p style="margin:2px 0;font-size:13px;"><strong>High Sales (50+):</strong> ${allOutOfStockProducts.filter(p => p.totalSales >= 50).length}</p>
                <p style="margin:2px 0;font-size:13px;"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
              </div>
            </div>
            ${buildFooterHtml()}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Out of Stock Inventory Report

Total Out of Stock: ${allOutOfStockProducts.length} products
${allOutOfStockProducts.map((p, i) => `${i + 1}. ${p.name} (${p.category?.name || 'N/A'}) - Sales: ${p.totalSales || 0}`).join('\n')}

Generated: ${new Date().toLocaleString()}
${buildFooterText()}`;

    const headers = buildCommonHeaders({ to: EMAIL_CONFIG.adminRecipients, subject });

    await transporter.sendMail({
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: EMAIL_CONFIG.adminRecipients,
      subject,
      html,
      text,
      headers,
      replyTo: EMAIL_CONFIG.sender,
    });
    console.log(`Complete out-of-stock report sent. Total out of stock: ${allOutOfStockProducts.length}`);

    return true;
  } catch (error) {
    console.error('Error sending complete out-of-stock report:', error);
    return false;
  }
};

const sendNewOrderPlacedNotification = async (order) => {
  try {
    const adminRecipient = EMAIL_CONFIG.adminRecipients;

    if (!adminRecipient || (Array.isArray(adminRecipient) && adminRecipient.length === 0)) {
      console.error('ADMIN_EMAIL is not configured. Cannot send order notification.');
      return false;
    }

    const orderId = order?.productOrderId || order?._id || "N/A";
    const orderedAt = order?.OrderedAt || new Date().toLocaleString();
    const paymentMethod = order?.paymentMethod || "N/A";
    const shippingLocation = order?.shippingLocation || order?.locationAddress || "N/A";
    const phoneNumber = order?.phoneNumber || "N/A";
    const totalAmount = Number(order?.totalAmount || 0);
    const shippingPrice = Number(order?.shippingPrice || 0);
    const giftBoxCharge = Number(order?.giftBoxCharge || 0);

    const userName = order?.userId?.name || "N/A";
    const userEmail = order?.userId?.email || "N/A";
    const userPhone = order?.userId?.phone || phoneNumber || "N/A";
    const userId = typeof order?.userId === "object" ? order?.userId?._id : order?.userId;

    let subtotal = 0;
    const productsHtml = (order?.products || [])
      .map((item, index) => {
        const productId = item?.productId?._id || item?.productId || "N/A";
        const productName = item?.productId?.name || "Product";
        const colorName = item?.colorName || "-";
        const quantity = Number(item?.quantity || 0);
        const linePrice = Number(item?.price || 0);
        subtotal += linePrice;
        const unitPrice = quantity > 0 ? linePrice / quantity : linePrice;
        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${index + 1}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
              <div style="font-weight:600;color:#111827;">${productName}</div>
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${colorName}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${quantity}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(unitPrice)}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrency(linePrice)}</td>
          </tr>
        `;
      })
      .join("");

    const subject = `New Order Placed - ${orderId}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="padding:28px 12px;">
          <div style="max-width:760px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;">
            <div style="padding:24px 22px 16px;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);text-align:center;border-bottom:1px solid #bbf7d0;">
              <h1 style="margin:0;font-size:22px;color:#166534;">New Order Notification</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#6b7280;">A new order has been placed successfully.</p>
            </div>
            <div style="padding:24px 22px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px;">
                <p style="margin:4px 0;font-size:14px;"><strong>Order ID:</strong> <span style="font-family:monospace;color:#0f766e;">${orderId}</span></p>
                <p style="margin:4px 0;font-size:14px;"><strong>Ordered At:</strong> ${orderedAt}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Customer:</strong> ${userName}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Email:</strong> ${userEmail}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Phone:</strong> ${userPhone}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Payment:</strong> ${paymentMethod}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Shipping:</strong> ${shippingLocation}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Delivery:</strong> ${order?.isHomeDelivery ? "Home Delivery" : "Store Pickup"}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Valley:</strong> ${order?.isInsideValley ? "Inside" : "Outside"}</p>
                ${order?.orderNote ? `<p style="margin:4px 0;font-size:14px;"><strong>Note:</strong> ${order.orderNote}</p>` : ''}
              </div>

              <h2 style="margin:0 0 10px;font-size:16px;color:#374151;">Ordered Products</h2>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">#</th>
                    <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Product</th>
                    <th style="padding:10px;text-align:center;border-bottom:1px solid #e2e8f0;">Color</th>
                    <th style="padding:10px;text-align:center;border-bottom:1px solid #e2e8f0;">Qty</th>
                    <th style="padding:10px;text-align:right;border-bottom:1px solid #e2e8f0;">Unit Price</th>
                    <th style="padding:10px;text-align:right;border-bottom:1px solid #e2e8f0;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsHtml || "<tr><td colspan='6' style='padding:10px;text-align:center;color:#6b7280;'>No product lines</td></tr>"}
                </tbody>
              </table>

              <div style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px;">
                <p style="margin:4px 0;text-align:right;font-size:14px;"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
                <p style="margin:4px 0;text-align:right;font-size:14px;"><strong>Shipping:</strong> ${formatCurrency(shippingPrice)}</p>
                <p style="margin:4px 0;text-align:right;font-size:14px;"><strong>Gift Box:</strong> ${formatCurrency(giftBoxCharge)}</p>
                <p style="margin:8px 0;text-align:right;font-size:17px;font-weight:700;color:#0f766e;"><strong>Grand Total:</strong> ${formatCurrency(totalAmount)}</p>
              </div>
            </div>
            ${buildFooterHtml()}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `New Order Placed - ${orderId}

Order ID: ${orderId}
Ordered At: ${orderedAt}
Customer: ${userName}
Email: ${userEmail}
Phone: ${userPhone}
Payment: ${paymentMethod}
Shipping: ${shippingLocation}
Delivery: ${order?.isHomeDelivery ? "Home Delivery" : "Store Pickup"}

Products:
${(order?.products || []).map((item, i) => `${i + 1}. ${item?.productId?.name || 'Product'} (x${item?.quantity || 0}) - ${formatCurrency(item?.price || 0)}`).join('\n')}

Subtotal: ${formatCurrency(subtotal)}
Shipping: ${formatCurrency(shippingPrice)}
Gift Box: ${formatCurrency(giftBoxCharge)}
Grand Total: ${formatCurrency(totalAmount)}
${buildFooterText()}`;

    const headers = buildCommonHeaders({ to: adminRecipient, subject });

    const info = await transporter.sendMail({
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: adminRecipient,
      subject,
      html,
      text,
      headers,
      replyTo: EMAIL_CONFIG.sender,
    });
    console.log('Admin notification email sent. Message ID:', info?.messageId, 'Recipients:', adminRecipient);
    return true;
  } catch (error) {
    console.error("Error sending new order notification email:", error?.message || error);
    console.error("SMTP Error details:", error?.code, error?.command);
    return false;
  }
};

const sendOrderConfirmationToCustomer = async (order) => {
  try {
    const customerEmail = order?.userId?.email || order?.email;
    if (!customerEmail) {
      return false;
    }

    const customerName = order?.userId?.name || order?.fullName || 'Valued Customer';
    const orderId = order?.productOrderId || order?._id || 'N/A';

    const totalAmount = Number(order?.totalAmount || 0);
    const shippingLocation = order?.shippingLocation || order?.locationAddress || 'N/A';
    const paymentMethod = order?.paymentMethod || 'N/A';
    const deliveryPartner = order?.deliveryPartner || 'Not assigned yet';
    const deliveryType = order?.isHomeDelivery ? 'Home Delivery' : 'Office Delivery';

    const subject = `Order Confirmed - ${orderId}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="padding:28px 12px;">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;">
            <div style="padding:24px 22px 16px;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);text-align:center;border-bottom:1px solid #bbf7d0;">
              <h1 style="margin:0;font-size:22px;color:#166534;">Order Confirmed</h1>
            </div>
            <div style="padding:24px 22px;">
              <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">Dear ${customerName},</p>
              <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
                Your order has been confirmed by our team and is now being prepared for delivery.
              </p>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:16px 0;">
                <p style="margin:4px 0;font-size:14px;"><strong>Order ID:</strong> <span style="font-family:monospace;color:#0f766e;">${orderId}</span></p>
                <p style="margin:4px 0;font-size:14px;"><strong>Total:</strong> ${formatCurrency(totalAmount)}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Payment:</strong> ${paymentMethod}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Delivery Type:</strong> ${deliveryType}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Delivery Partner:</strong> ${deliveryPartner}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Address:</strong> ${shippingLocation}</p>
              </div>

              <p style="font-size:14px;line-height:1.6;margin:16px 0;">
                We have attached your order invoice to this email for your records.
              </p>
              <p style="font-size:14px;line-height:1.6;margin:16px 0;">
                If you need any help, please contact us at ${EMAIL_CONFIG.sender}.
              </p>
              <p style="font-size:14px;line-height:1.6;margin:18px 0 0;">Thank you for shopping with Aabhushan Gallery.</p>
            </div>
            ${buildFooterHtml()}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Order Confirmed - ${orderId}

Dear ${customerName},

Your order has been confirmed by our team and is now being prepared.

Order ID: ${orderId}
Total: ${formatCurrency(totalAmount)}
Payment: ${paymentMethod}
Delivery Type: ${deliveryType}
Delivery Partner: ${deliveryPartner}
Address: ${shippingLocation}

We have attached your order invoice to this email for your records.

If you need help, contact us at ${EMAIL_CONFIG.sender}.

Thank you for shopping with Aabhushan Gallery.
${buildFooterText()}`;

    const invoicePng = await generateInvoicePngBuffer({
      order,
      customerEmail,
      customerName,
      senderEmail: EMAIL_CONFIG.sender,
      title: 'Order Confirmation',
    });

    const fallbackPng = invoicePng
      ? null
      : await generateInvoicePngFromSvgBuffer({
          order,
          customerEmail,
          customerName,
          senderEmail: EMAIL_CONFIG.sender,
          title: 'Order Confirmation',
        });

    const finalInvoicePng = invoicePng || fallbackPng;

    const attachment = finalInvoicePng
      ? [{
          filename: `invoice-${orderId}.png`,
          content: finalInvoicePng,
          contentType: 'image/png',
        }]
      : [];

    if (!finalInvoicePng) {
      console.error('Unable to generate invoice PNG for order:', orderId, '- sending without attachment');
    }

    const headers = buildCommonHeaders({ to: customerEmail, subject });

    await transporter.sendMail({
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: customerEmail,
      subject,
      html,
      text,
      headers,
      attachments: attachment,
      replyTo: EMAIL_CONFIG.sender,
    });

    console.log('Order confirmation email sent to customer:', customerEmail, 'for order:', orderId);
    return true;
  } catch (error) {
    console.error('Error sending order confirmation email:', error?.message || error);
    return false;
  }
};

const sendOrderPlacedConfirmationToCustomer = async (order) => {
  try {
    const customerEmail = order?.userId?.email || order?.email;
    if (!customerEmail) {
      console.log('No customer email found, skipping order placed confirmation');
      return false;
    }

    const customerName = order?.userId?.name || order?.fullName || 'Valued Customer';
    const orderId = order?.productOrderId || order?._id || 'N/A';
    const totalAmount = Number(order?.totalAmount || 0);
    const shippingLocation = order?.shippingLocation || order?.locationAddress || 'N/A';
    const paymentMethod = order?.paymentMethod || 'N/A';
    const shippingPrice = Number(order?.shippingPrice || 0);
    const giftBoxCharge = Number(order?.giftBoxCharge || 0);

    let subtotal = 0;
    const productsHtml = (order?.products || [])
      .map((item, index) => {
        const productName = item?.productId?.name || 'Product';
        const colorName = item?.colorName || '-';
        const quantity = Number(item?.quantity || 0);
        const linePrice = Number(item?.price || 0);
        subtotal += linePrice;
        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${index + 1}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:600;">${productName}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${colorName}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${quantity}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(linePrice)}</td>
          </tr>
        `;
      })
      .join('');

    const subject = `Order Received - ${orderId}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="padding:28px 12px;">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;">
            <div style="padding:24px 22px 16px;background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);text-align:center;border-bottom:1px solid #bfdbfe;">
              <h1 style="margin:0;font-size:22px;color:#1e40af;">Order Received</h1>
            </div>
            <div style="padding:24px 22px;">
              <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">Dear ${customerName},</p>
              <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
                Thank you for your order! We have received your order and it is now being reviewed by our team.
                You will receive another confirmation email once your order is approved.
              </p>

              <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin:16px 0;">
                <p style="margin:4px 0;font-size:14px;"><strong>Order ID:</strong> <span style="font-family:monospace;color:#0369a1;">${orderId}</span></p>
                <p style="margin:4px 0;font-size:14px;"><strong>Payment:</strong> ${paymentMethod}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Address:</strong> ${shippingLocation}</p>
                <p style="margin:4px 0;font-size:14px;"><strong>Grand Total:</strong> ${formatCurrency(totalAmount)}</p>
              </div>

              <h2 style="margin:16px 0 8px;font-size:16px;color:#374151;">Order Summary</h2>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">#</th>
                    <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Product</th>
                    <th style="padding:10px;text-align:center;border-bottom:1px solid #e2e8f0;">Color</th>
                    <th style="padding:10px;text-align:center;border-bottom:1px solid #e2e8f0;">Qty</th>
                    <th style="padding:10px;text-align:right;border-bottom:1px solid #e2e8f0;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsHtml}
                </tbody>
              </table>

              <div style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px;">
                <p style="margin:4px 0;text-align:right;font-size:14px;"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
                <p style="margin:4px 0;text-align:right;font-size:14px;"><strong>Shipping:</strong> ${formatCurrency(shippingPrice)}</p>
                ${giftBoxCharge > 0 ? `<p style="margin:4px 0;text-align:right;font-size:14px;"><strong>Gift Box:</strong> ${formatCurrency(giftBoxCharge)}</p>` : ''}
                <p style="margin:8px 0;text-align:right;font-size:17px;font-weight:700;color:#0369a1;"><strong>Grand Total:</strong> ${formatCurrency(totalAmount)}</p>
              </div>

              <p style="font-size:14px;line-height:1.6;margin:16px 0;">
                We have attached your order invoice to this email for your records.
              </p>
              <p style="font-size:14px;line-height:1.6;margin:16px 0;">
                If you have any questions, please contact us at ${EMAIL_CONFIG.sender}.
              </p>
              <p style="font-size:14px;line-height:1.6;margin:18px 0 0;">Thank you for shopping with Aabhushan Gallery.</p>
            </div>
            ${buildFooterHtml()}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Order Received - ${orderId}

Dear ${customerName},

Thank you for your order! We have received your order and it is now being reviewed.
You will receive another confirmation email once your order is approved.

Order ID: ${orderId}
Payment: ${paymentMethod}
Address: ${shippingLocation}
Grand Total: ${formatCurrency(totalAmount)}

Order Summary:
${(order?.products || []).map((item, i) => `${i + 1}. ${item?.productId?.name || 'Product'} (${item?.colorName || '-'}) x${item?.quantity || 0} - ${formatCurrency(item?.price || 0)}`).join('\n')}

Subtotal: ${formatCurrency(subtotal)}
Shipping: ${formatCurrency(shippingPrice)}
${giftBoxCharge > 0 ? `Gift Box: ${formatCurrency(giftBoxCharge)}\n` : ''}Grand Total: ${formatCurrency(totalAmount)}

We have attached your order invoice to this email for your records.

If you have any questions, contact us at ${EMAIL_CONFIG.sender}.

Thank you for shopping with Aabhushan Gallery.
${buildFooterText()}`;

    const invoicePng = await generateInvoicePngBuffer({
      order,
      customerEmail,
      customerName,
      senderEmail: EMAIL_CONFIG.sender,
      title: 'Order Invoice',
    });

    const fallbackPng = invoicePng
      ? null
      : await generateInvoicePngFromSvgBuffer({
          order,
          customerEmail,
          customerName,
          senderEmail: EMAIL_CONFIG.sender,
          title: 'Order Invoice',
        });

    const finalInvoicePng = invoicePng || fallbackPng;

    const attachment = finalInvoicePng
      ? [{
          filename: `invoice-${orderId}.png`,
          content: finalInvoicePng,
          contentType: 'image/png',
        }]
      : [];

    if (!finalInvoicePng) {
      console.error('Unable to generate invoice PNG for order placed confirmation:', orderId);
    }

    const headers = buildCommonHeaders({ to: customerEmail, subject });

    await transporter.sendMail({
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: customerEmail,
      subject,
      html,
      text,
      headers,
      attachments: attachment,
      replyTo: EMAIL_CONFIG.sender,
    });

    console.log('Order placed confirmation email sent to:', customerEmail, 'for order:', orderId);
    return true;
  } catch (error) {
    console.error('Error sending order placed confirmation email:', error?.message || error);
    return false;
  }
};

module.exports = {
  sendOutOfStockNotification,
  sendCompleteOutOfStockReport,
  sendNewOrderPlacedNotification,
  sendOrderConfirmationToCustomer,
  sendOrderPlacedConfirmationToCustomer,

  transporter,
  EMAIL_CONFIG,
};
