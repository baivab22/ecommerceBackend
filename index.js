const express = require("express");
const path = require("path");

const app = express();
require("dotenv").config();
require("./db");
const PORT = process.env.PORT || 8080;
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");

const authRouter = require("./routes/authRoutes");
const productRouter = require("./routes/product.routes");
const CategoryRouter = require("./routes/categoryRoutes");
const bannerRouter = require("./routes/bannerRoutes");
const cartRouter = require("./routes/cartRoutes");
const testimonialRouter = require("./routes/testimonialRoutes");
const shopByBudgetRouter = require("./routes/shopByBudget.routes");
const ordersRouter = require("./routes/orders.routes");
const socialItemRouter = require("./routes/socialItem.routes");
// const holidayModeRouter= require("./routes/holidayMode.routes");
const holidayModeRouter=require("./routes/holidayMode.routes");


console.log(process.env.PORT, "port number");

app.use(cors());

app.use(express.static("uploads"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/api", authRouter);
app.use("/api", productRouter);
app.use("/api", CategoryRouter);
app.use("/api", bannerRouter);
app.use("/api", cartRouter);
app.use("/api", testimonialRouter);
app.use("/api", shopByBudgetRouter);
app.use("/api", ordersRouter);
app.use("/api", socialItemRouter);
app.use('/api',holidayModeRouter);

console.log("hello main");

// app.get("/", (req, res) => {
//   res.send("products api running new deploy");
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

