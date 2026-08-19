const mongoose = require("mongoose");

mongoose
  .connect(process.env.DBHOST)
  .then(() => {
    console.log("MongoDB Connected...");
  })
  .catch((err) => {
    console.log("Error while Mongo Conn..", err);
  });
