const fs = require('fs');
const path = require('path');
const {
  buildInvoiceHtml,
  buildInvoiceSvg,
  generateInvoicePngBuffer,
  extractInvoiceData,
} = require('../services/invoiceRenderer.service');

(async () => {
  const order = {
    productOrderId: '65850',
    OrderedAt: new Date('2026-05-25T10:00:00Z'),
    paymentMethod: 'esewa',
    shippingPrice: 100,
    includeGiftBox: false,
    totalAmount: 700,
    fullName: 'Baivab Bidari',
    shippingLocation: 'Kalanki, Kuleshwar',
    locationAddress: 'Kathmandu-14, Kathmandu',
    phoneNumber: '9861698400',
    products: [
      { productId: { name: 'Small Pearl And Large Stone On Both Side' }, colorName: 'Gold', quantity: 1, price: 600 },
      { productId: { name: 'Traditional Tikma Necklace Set' }, colorName: 'Silver', quantity: 2, price: 5000 },
    ],
  };

  const data = extractInvoiceData({ order, customerEmail: 'bidaribaivab7@gmail.com', customerName: 'Baivab Bidari', title: 'Order Confirmation' });
  const OUT_DIR = path.join(__dirname, 'output');

  // SVG fallback must embed the logo
  const svg = buildInvoiceSvg(data);
  fs.writeFileSync(path.join(OUT_DIR, 'invoice-example.svg'), svg, 'utf8');
  console.log('SVG embeds logo :', svg.includes('<image') && svg.includes('data:image/png;base64,'));

  const html = buildInvoiceHtml({ ...data, invoiceNo: data.invoiceNo });
  fs.writeFileSync(path.join(OUT_DIR, 'invoice-example.html'), html, 'utf8');

  const png = await generateInvoicePngBuffer(data);
  if (!png) { console.error('PNG failed'); process.exit(1); }
  fs.writeFileSync(path.join(OUT_DIR, 'invoice-example.png'), png);
  console.log('PNG size        :', png.length.toLocaleString(), 'bytes');

  // Verify the logo <img> actually loads inside headless Chrome
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const logoOk = await page.evaluate(() => {
    const img = document.querySelector('.logo-img');
    return !!img && img.naturalWidth > 0;
  });
  await browser.close();
  console.log('Logo renders    :', logoOk);
  process.exit(logoOk ? 0 : 1);
})();
