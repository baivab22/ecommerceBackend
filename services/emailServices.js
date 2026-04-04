const { EMAIL_CONFIG, transporter } = require('./mailConfig');
const { Product } = require("../modals/product.modal");
const {
  buildInvoiceHtml,
  generateInvoicePngBuffer,
  generateInvoiceSvgBuffer,
} = require('./invoiceRenderer.service');

const sendOutOfStockNotification = async (newOutOfStockProducts) => {
  try {
    // Get ALL current out-of-stock products from the database
    const allOutOfStockProducts = await Product.find({ 
      stockQuantity: 0 
    }).populate('category').populate('subCategory');

    console.log('allout of stock products:', allOutOfStockProducts);

    const mailOptions = {
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: EMAIL_CONFIG.adminRecipients,
      subject: `🚨 Product Out of Stock Alert - ${newOutOfStockProducts.length} New Product(s) Out of Stock`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">🚨 Product Out of Stock Alert</h2>
          <p>Dear Admin,</p>
          
          <!-- New Out of Stock Products Section -->
          <div style="margin: 20px 0;">
            <h3 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px;">
              Newly Out of Stock Products (${newOutOfStockProducts.length})
            </h3>
            <p>The following products have just gone out of stock:</p>
            <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #d32f2f;">
              ${newOutOfStockProducts.map(product => `
                <div style="padding: 10px; border-bottom: 1px solid #ffcdd2; margin-bottom: 10px;">
                  <h4 style="margin: 0 0 8px 0; color: #c62828;">${product.name}</h4>
                  <p style="margin: 4px 0;"><strong>Product ID:</strong> ${product._id}</p>
                  <p style="margin: 4px 0;"><strong>Previous Stock:</strong> ${product.previousStock} units</p>
                  <p style="margin: 4px 0;"><strong>Ordered Quantity:</strong> ${product.orderedQuantity} units</p>
                  <p style="margin: 4px 0;"><strong>Price:</strong> $${product.price || 'N/A'}</p>
                  <p style="margin: 4px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Complete Out of Stock List Section -->
          <div style="margin: 30px 0;">
            <h3 style="color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px;">
              Complete Out of Stock Inventory (${allOutOfStockProducts.length} Total Products)
            </h3>
            <p>Here is the complete list of all products currently out of stock in your system:</p>
            <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f57c00;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #ffe0b2;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ffb74d;">Product Name</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ffb74d;">ID</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ffb74d;">Price</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ffb74d;">Category</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ffb74d;">Total Sales</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ffb74d;">Last Sold</th>
                  </tr>
                </thead>
                <tbody>
                  ${allOutOfStockProducts.map(product => `
                    <tr style="border-bottom: 1px solid #ffe0b2;">
                      <td style="padding: 10px;">${product.name}</td>
                      <td style="padding: 10px; font-family: monospace;">${product._id}</td>
                      <td style="padding: 10px;">$${product.price || 'N/A'}</td>
                      <td style="padding: 10px;">${product.category?.name || 'N/A'}</td>
                      <td style="padding: 10px;">${product.totalSales || 0}</td>
                      <td style="padding: 10px;">${product.lastSoldAt ? new Date(product.lastSoldAt).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              ${allOutOfStockProducts.length === 0 ? `
                <p style="text-align: center; color: #666; padding: 20px;">No products are currently out of stock.</p>
              ` : ''}
            </div>
          </div>

          <!-- Summary Section -->
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <h4 style="margin: 0 0 10px 0; color: #2e7d32;">Inventory Summary</h4>
            <p style="margin: 5px 0;"><strong>New Out of Stock Today:</strong> ${newOutOfStockProducts.length} product(s)</p>
            <p style="margin: 5px 0;"><strong>Total Out of Stock:</strong> ${allOutOfStockProducts.length} product(s)</p>
            <p style="margin: 5px 0;"><strong>Report Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <p>Please review and restock these products as soon as possible to avoid lost sales.</p>
          
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated notification from your e-commerce system.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Out-of-stock notification sent for ${newOutOfStockProducts.length} new products. Total out of stock: ${allOutOfStockProducts.length}`);
    
    return true;
  } catch (error) {
    console.error('Error sending out-of-stock notification:', error);
    return false;
  }
};

// New function to send complete out-of-stock report
const sendCompleteOutOfStockReport = async () => {
  try {
    const allOutOfStockProducts = await Product.find({ 
      stockQuantity: 0 
    })
    .populate('category')
    .populate('subCategory')
    .sort({ totalSales: -1, lastSoldAt: -1 });

    const mailOptions = {
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: EMAIL_CONFIG.adminRecipients,
      subject: `📊 Complete Out of Stock Report - ${allOutOfStockProducts.length} Products`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #f57c00;">📊 Complete Out of Stock Inventory Report</h2>
          <p>Dear Admin,</p>
          <p>Here is the complete list of all products currently out of stock in your system:</p>
          
          <div style="background-color: #fff3e0; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffb74d;">
            <h3 style="color: #f57c00; margin-top: 0;">Out of Stock Products: ${allOutOfStockProducts.length}</h3>
            
            ${allOutOfStockProducts.length > 0 ? `
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                  <tr style="background-color: #ffe0b2;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ffb74d;">Product Name</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ffb74d;">ID</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ffb74d;">Price</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ffb74d;">Category</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ffb74d;">Total Sales</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ffb74d;">Last Sold</th>
                  </tr>
                </thead>
                <tbody>
                  ${allOutOfStockProducts.map((product, index) => `
                    <tr style="${index % 2 === 0 ? 'background-color: #fff8e1;' : 'background-color: white;'}">
                      <td style="padding: 10px; border-bottom: 1px solid #ffe0b2;"><strong>${product.name}</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ffe0b2; font-family: monospace; font-size: 12px;">${product._id}</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ffe0b2;">$${product.price || 'N/A'}</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ffe0b2;">${product.category?.name || 'N/A'}</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ffe0b2; text-align: center;">${product.totalSales || 0}</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ffe0b2;">${product.lastSoldAt ? new Date(product.lastSoldAt).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div style="text-align: center; padding: 40px; color: #666;">
                <h3 style="color: #4caf50;">🎉 Excellent!</h3>
                <p>No products are currently out of stock. Your inventory is fully stocked!</p>
              </div>
            `}
          </div>

          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #1565c0;">Report Summary</h4>
            <p style="margin: 5px 0;"><strong>Total Out of Stock Products:</strong> ${allOutOfStockProducts.length}</p>
            <p style="margin: 5px 0;"><strong>High Sales Products (50+ sales):</strong> ${allOutOfStockProducts.filter(p => p.totalSales >= 50).length}</p>
            <p style="margin: 5px 0;"><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated inventory report from your e-commerce system.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
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

    const formatCurrency = (value) => `NPR ${Number(value || 0).toFixed(2)}`;

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
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">
              <div style="font-weight: 600;">${productName}</div>
              <div style="color: #6b7280; font-size: 12px;">ID: ${productId}</div>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${colorName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(unitPrice)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(linePrice)}</td>
          </tr>
        `;
      })
      .join("");

    const mailOptions = {
      from: `"Aabhushan Gallery" <${EMAIL_CONFIG.sender}>`,
      to: adminRecipient,
      subject: `New Order Placed - ${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 760px; margin: 0 auto;">
          <h2 style="color: #0f766e;">New Order Notification</h2>
          <p>A new order has been placed successfully.</p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <p style="margin: 4px 0;"><strong>Order ID:</strong> ${orderId}</p>
            <p style="margin: 4px 0;"><strong>Ordered At:</strong> ${orderedAt}</p>
            <p style="margin: 4px 0;"><strong>Customer Name:</strong> ${userName}</p>
            <p style="margin: 4px 0;"><strong>Customer Email:</strong> ${userEmail}</p>
            <p style="margin: 4px 0;"><strong>Customer Phone:</strong> ${userPhone}</p>
            <p style="margin: 4px 0;"><strong>User ID:</strong> ${userId || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Payment Method:</strong> ${paymentMethod}</p>
            <p style="margin: 4px 0;"><strong>Shipping Location:</strong> ${shippingLocation}</p>
            <p style="margin: 4px 0;"><strong>Full Address:</strong> ${order?.locationAddress || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Delivery Type:</strong> ${order?.isHomeDelivery ? "Home Delivery" : "Store Pickup / Other"}</p>
            <p style="margin: 4px 0;"><strong>Inside Valley:</strong> ${order?.isInsideValley ? "Yes" : "No"}</p>
            <p style="margin: 4px 0;"><strong>Order Note:</strong> ${order?.orderNote || "-"}</p>
          </div>

          <h3 style="margin-bottom: 8px;">Ordered Products</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">#</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Product</th>
                <th style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">Color</th>
                <th style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">Qty</th>
                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Unit Price</th>
                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${productsHtml || "<tr><td colspan='6' style='padding: 8px;'>No product lines</td></tr>"}
            </tbody>
          </table>

          <div style="margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
            <p style="margin: 4px 0; text-align: right;"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
            <p style="margin: 4px 0; text-align: right;"><strong>Shipping Charge:</strong> ${formatCurrency(shippingPrice)}</p>
            <p style="margin: 4px 0; text-align: right;"><strong>Gift Box Charge:</strong> ${formatCurrency(giftBoxCharge)}</p>
            <p style="margin: 8px 0; text-align: right; font-size: 16px;"><strong>Grand Total:</strong> ${formatCurrency(totalAmount)}</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending new order notification email:", error);
    return false;
  }
};

const sendOrderConfirmationToCustomer = async (order) => {
  try {
    const customerEmail = order?.userId?.email;
    if (!customerEmail) {
      return false;
    }

    const customerName = order?.userId?.name || 'Valued Customer';
    const orderId = order?.productOrderId || order?._id || 'N/A';

    const confirmationSubject = `Order Confirmation #${orderId}`;
    const confirmationHtml = buildInvoiceHtml({
      order,
      customerEmail,
      customerName,
      senderEmail: EMAIL_CONFIG.sender,
      title: 'Order Confirmation',
    });

    const invoicePng = await generateInvoicePngBuffer({
      order,
      customerEmail,
      customerName,
      senderEmail: EMAIL_CONFIG.sender,
      title: 'Order Confirmation',
    });

    // Always include exactly one image attachment.
    const attachment = invoicePng
      ? {
          filename: `order-confirmation-${orderId}.png`,
          content: invoicePng,
          contentType: 'image/png',
        }
      : {
          filename: `order-confirmation-${orderId}.svg`,
          content: generateInvoiceSvgBuffer({
            order,
            customerEmail,
            customerName,
            senderEmail: EMAIL_CONFIG.sender,
            title: 'Order Confirmation',
          }),
          contentType: 'image/svg+xml',
        };

    await transporter.sendMail({
      from: EMAIL_CONFIG.sender,
      to: customerEmail,
      subject: confirmationSubject,
      html: confirmationHtml,
      attachments: [attachment],
    });

    return true;
  } catch (error) {
    console.error('Error sending order confirmation email to customer:', error);
    return false;
  }
};

module.exports = {
  sendOutOfStockNotification,
  sendCompleteOutOfStockReport,
  sendNewOrderPlacedNotification,
  sendOrderConfirmationToCustomer,
  transporter,
  EMAIL_CONFIG,
};