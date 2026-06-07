
// process.env.UNDICI_WASM = '0';
// const express = require("express");
// const path = require("path");
// const fs = require("fs");
// require("dotenv").config();
// require("./db");

// const app = express();
// const PORT = process.env.PORT || 8000;

// const cors = require("cors");
// const bodyParser = require("body-parser");
// const dotenv = require("dotenv");

// // Routers
// const authRouter = require("./routes/authRoutes");
// const productRouter = require("./routes/product.routes");
// const CategoryRouter = require("./routes/categoryRoutes");
// const bannerRouter = require("./routes/bannerRoutes");
// const cartRouter = require("./routes/cartRoutes");
// const testimonialRouter = require("./routes/testimonialRoutes");
// const shopByBudgetRouter = require("./routes/shopByBudget.routes");
// const ordersRouter = require("./routes/orders.routes");
// const socialItemRouter = require("./routes/socialItem.routes");
// const holidayModeRouter = require("./routes/holidayMode.routes");
// const emailMarketingRoutes = require('./routes/emailMarketingRoutes');
// const { startNcmOrderSchedulers } = require('./schedulers/ncmOrder.scheduler');
// const { startHolidayModeSchedulers } = require('./schedulers/holidayMode.scheduler');

// console.log(process.env.PORT, "port number");

// // Middlewares
// app.use(cors());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: false }));

// const uploadsDir = path.join(__dirname, "uploads");
// const uploadsVideoDir = path.join(uploadsDir, "video");
// const uploadsProductsDir = path.join(uploadsDir, "products");

// // Legacy: some videos were saved under uploads/products — serve from video URL too
// app.use("/uploads/video", (req, res, next) => {
//   const fileName = path.basename(req.path);
//   if (!fileName) return next();

//   const videoPath = path.join(uploadsVideoDir, fileName);
//   const legacyProductsPath = path.join(uploadsProductsDir, fileName);

//   if (fs.existsSync(videoPath)) {
//     return res.sendFile(videoPath);
//   }
//   if (fs.existsSync(legacyProductsPath)) {
//     return res.sendFile(legacyProductsPath);
//   }
//   return res.status(404).send("Video not found");
// });

// app.use("/uploads", express.static(uploadsDir));

// // Backward compatibility: keep old root-level asset links working.
// app.get("/products/:file", (req, res) => {
//   res.redirect(301, `/uploads/products/${req.params.file}`);
// });

// app.get("/video/:file", (req, res) => {
//   res.redirect(301, `/uploads/video/${req.params.file}`);
// });

// app.get("/banners/:file", (req, res) => {
//   res.redirect(301, `/uploads/banners/${req.params.file}`);
// });

// // // Serve uploaded files
// // app.use("/uploads", express.static("uploads"));

// // // API routes
// app.use("/api", authRouter);
// app.use("/api", productRouter);
// app.use("/api", CategoryRouter);
// app.use("/api", bannerRouter);
// app.use("/api", cartRouter);
// app.use("/api", testimonialRouter);
// app.use("/api", shopByBudgetRouter);
// app.use("/api", ordersRouter);
// app.use("/api", socialItemRouter);
// app.use("/api", holidayModeRouter);
// app.use('/api/email', emailMarketingRoutes);

// app.use('/api/scan', require('./routes/scanRoutes'));

// console.log("Backend server running...");




// // // Root endpoint (optional)
// // app.get("/", (req, res) => {
// //   res.send("Backend API is running...");
// // });

// // // Start server
// // app.listen(PORT, () => {
// //   console.log(`Server initialized successfully on port ${PORT}`);
// // });




// // Serve frontend build
// app.use(express.static(path.join(__dirname, "frontend/dist")));

// // Any other route not handled by API will serve index.html
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "frontend/dist", "index.html"));
// });
// app.listen(PORT, () => {
//   console.log(`server initialized successfully in port no 8000`);
//   startHolidayModeSchedulers();
//   startNcmOrderSchedulers();
// });


// // Serve static files from uploads folder
// // app.use("/uploads", express.static(path.join(__dirname, "uploads")));


process.env.UNDICI_WASM = "0";

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");

require("dotenv").config();
require("./db");

const app = express();
const PORT = process.env.PORT || 8000;

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
const emailMarketingRoutes = require("./routes/emailMarketingRoutes");
const scanRoutes = require("./routes/scanRoutes");

const {
  startNcmOrderSchedulers,
} = require("./schedulers/ncmOrder.scheduler");

const {
  startHolidayModeSchedulers,
} = require("./schedulers/holidayMode.scheduler");

console.log("PORT:", PORT);

// ====================
// Middlewares
// ====================

app.use(cors());

app.use(bodyParser.json());

app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

// ====================
// Uploads
// ====================

const uploadsDir = path.join(__dirname, "uploads");
const uploadsVideoDir = path.join(uploadsDir, "video");
const uploadsProductsDir = path.join(uploadsDir, "products");

// Serve uploads folder

app.use("/uploads", express.static(uploadsDir));

// Legacy video compatibility

app.use("/uploads/video", (req, res, next) => {
  const fileName = path.basename(req.path);

  if (!fileName) {
    return next();
  }

  const videoPath = path.join(
    uploadsVideoDir,
    fileName
  );

  const legacyProductsPath = path.join(
    uploadsProductsDir,
    fileName
  );

  if (fs.existsSync(videoPath)) {
    return res.sendFile(videoPath);
  }

  if (fs.existsSync(legacyProductsPath)) {
    return res.sendFile(legacyProductsPath);
  }

  return res.status(404).send("Video not found");
});

// ====================
// Legacy redirects
// ====================

app.get("/products/:file", (req, res) => {
  return res.redirect(
    301,
    `/uploads/products/${req.params.file}`
  );
});

app.get("/video/:file", (req, res) => {
  return res.redirect(
    301,
    `/uploads/video/${req.params.file}`
  );
});

app.get("/banners/:file", (req, res) => {
  return res.redirect(
    301,
    `/uploads/banners/${req.params.file}`
  );
});

// ====================
// API Routes
// ====================

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

app.use("/api/email", emailMarketingRoutes);
app.use("/api/scan", scanRoutes);

// ====================
// Health Check
// ====================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Abhushan Gallery API is running",
    environment: process.env.NODE_ENV || "development",
  });
});

// ====================
// 404 Handler
// ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ====================
// Start Server
// ====================

app.listen(PORT, () => {
  console.log(
    `Server initialized successfully on port ${PORT}`
  );

  startHolidayModeSchedulers();
  startNcmOrderSchedulers();
});
