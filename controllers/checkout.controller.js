const Cart = require("../modals/cart.modal");
const Checkout = require("../modals/checkout.modal");

exports.createCheckout = async (req, res) => {
  try {
    const existingCart = await Cart.findOne({ userId: req.body.userId });

    if (existingCart) {
      existingCart.products.push(...(req.body.products || []));
      const savedCart = await existingCart.save();
      res
        .status(200)
        .json({ data: savedCart, message: "Updated existing cart" });
    } else {
      const newCheckout = new Checkout(req.body);
      const savedCheckout = await newCheckout.save();
      res
        .status(201)
        .json({ data: savedCheckout, message: "Successfully created checkout" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
