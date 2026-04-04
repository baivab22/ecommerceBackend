
process.env.UNDICI_WASM = '0';
const express = require("express");
const path = require("path");
require("dotenv").config();
require("./db");

const app = express();
const PORT = process.env.PORT || 8000;

const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

// Routers
const authRouter = require("./routes/authRoutes");
const productRouter = require("./routes/product.routes");
const CategoryRouter = require("./routes/categoryRoutes");
const bannerRouter = require("./routes/bannerRoutes");
const cartRouter = require("./routes/cartRoutes");
const testimonialRouter = require("./routes/testimonialRoutes");
const shopByBudgetRouter = require("./routes/shopByBudget.routes");
const ordersRouter = require("./routes/orders.routes");
const socialItemRouter = require("./routes/socialItem.routes");
const holidayModeRouter = require("./routes/holidayMode.routes");
const emailMarketingRoutes = require('./routes/emailMarketingRoutes');

console.log(process.env.PORT, "port number");

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// Backward compatibility: keep old root-level asset links working.
app.get("/products/:file", (req, res) => {
  res.redirect(301, `/uploads/products/${req.params.file}`);
});

app.get("/video/:file", (req, res) => {
  res.redirect(301, `/uploads/video/${req.params.file}`);
});

app.get("/banners/:file", (req, res) => {
  res.redirect(301, `/uploads/banners/${req.params.file}`);
});

// // Serve uploaded files
// app.use("/uploads", express.static("uploads"));

// // API routes
app.use("/api", authRouter);
app.use("/api", productRouter);
app.use("/api", CategoryRouter);
app.use("/api", bannerRouter);
app.use("/api", cartRouter);
app.use("/api", testimonialRouter);
app.use("/api", shopByBudgetRouter);
app.use("/api", ordersRouter);
app.use("/api", socialItemRouter);
app.use("/api", holidayModeRouter);
app.use('/api/email', emailMarketingRoutes);

app.use('/api/scan', require('./routes/scanRoutes'));

console.log("Backend server running...");




// // Root endpoint (optional)
// app.get("/", (req, res) => {
//   res.send("Backend API is running...");
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`Server initialized successfully on port ${PORT}`);
// });




// Serve frontend build
app.use(express.static(path.join(__dirname, "frontend/dist")));

// Any other route not handled by API will serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dist", "index.html"));
});
app.listen(PORT, () => {
  console.log(`server initialized successfully in port no 8000`);
});


// Serve static files from uploads folder
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));