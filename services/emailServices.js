const nodemailer = require('nodemailer');
const { Product } = require("../modals/product.modal");
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "baivabbidari876@gmail.com",
    pass: "djuw xkgi vbpi vwqc",
  },
});

const sendOutOfStockNotification = async (newOutOfStockProducts) => {
  try {
    // Get ALL current out-of-stock products from the database
    const allOutOfStockProducts = await Product.find({ 
      stockQuantity: 0 
    }).populate('category').populate('subCategory');

    console.log('allout of stock products:', allOutOfStockProducts);

    const mailOptions = {
      from: "baivabbidari876@gmail.com",
      to: "bidaribadri097@gmail.com",
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
      from: "baivabbidari876@gmail.com",
      to: "myname12@gmail.com",
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

module.exports = {
  sendOutOfStockNotification,
  sendCompleteOutOfStockReport,
  transporter
};