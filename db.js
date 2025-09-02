const mongoose = require("mongoose");
const dbHOST = process.env.DBHOST;

mongoose
  .connect(
    // "mongodb+srv://bidaribaivab7:p8obzODALBzdJdyn@cluster1.sx4gni2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1"
    "mongodb+srv://bidaribaivab7:(meropassword12)@cluster0.l1lbpsa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => {
    console.log("MongoDB Connnected...");
  })
  .catch((err) => {
    console.log("Error while Mongo Conn..", err);
  });
