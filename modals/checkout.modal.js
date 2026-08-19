const mongoose = require("mongoose");

const CheckoutProductSchema = new mongoose.Schema({
  userId: String,
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: Number,
    },
  ],
});

module.exports = mongoose.model("Checkout", CheckoutProductSchema);
