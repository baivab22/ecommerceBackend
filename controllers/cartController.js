const Cart = require("../modals/cart.modal"); 

exports.createCart = async (req, res) => {
  try {
    const existingCart = await Cart.findOne({ userId: req.body.userId });

    if (existingCart) {
      existingCart.products.push(...req.body.products);
      const savedCart = await existingCart.save();

      res
        .status(200)
        .json({ data: savedCart, message: "Updated existing cart" });
    } else {
      const newCart = new Cart(req.body);
      const savedCart = await newCart.save();
      res
        .status(201)
        .json({ data: savedCart, message: "Successfully created cart" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUsersCartByUserId = async (req, res) => {
  try {
    const cart = await Cart.find({ userId: req.params.userId })
      .populate({
        path: "products.productId",
        populate: {
          path: "images",
        },
      });

    if (!cart) {
      res.status(404).json({ message: "User not found" });
    } else {
      res.json({ data: cart, success: "successfully found cartitems" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCartProduct = async (req, res) => {
  try {
    const { productId, userId, quantity, price } = req.body;

    console.log(quantity, "quantity");

    const cart = await Cart.findOne({ userId: userId });

    console.log("hello update cart hai ta");

    if (!cart) {
      console.log("if");
      return res.status(404).json({ message: "User not found" });
    } else {
      const productToUpdate = cart.products.find(
        (item) => item.productId == productId
      );
      if (productToUpdate) {
        console.log("else if", quantity, price);
        productToUpdate.quantity = quantity;
        productToUpdate.price = price;
        const updatedCart = await cart.save();

        console.log(updatedCart, "updatedCart");
        res.status(201).json({
          data: updatedCart,
          message: "Successfully updated product cart",
        });
      } else {
        return res.status(404).json({ message: "Product not found in cart" });
      }
    }
  } catch (err) {
    console.log(err, "error");
    res.status(500).json({ error: err.message });
  }
};

// MODIFIED: Delete all products from cart
exports.deleteCart = async (req, res) => {
  try {
    console.log("Deleting all products from cart for userId:", req.params.userId);

    const cart = await Cart.findOne({ userId: req.params.userId });
    
    if (!cart) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Clear all products from the cart
    cart.products = [];
    
    const updatedCart = await cart.save();
    
    return res.json({ 
      data: updatedCart, 
      message: "Successfully deleted all products from cart" 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.deleteProductFromCart = async (req, res) => {
  console.log("delete product from cart");
  try {
    const { productId } = req.params;
    const { userId } = req.body;
    console.log("delete cart", productId, userId);

    const cart = await Cart.findOne({ userId: userId });
    console.log("cart", cart);
    if (!cart) {
      return res.status(404).json({ message: "User not found" });
    } else {
      console.log(cart.products, "cart products ");
      const productIndex = cart.products.findIndex(
        (product) => product?._id.toString() === productId
      );

      if (productIndex !== -1) {
        console.log(productIndex, "product index value");
        // Remove the product from the products array
        cart.products.splice(productIndex, 1);

        // Save the updated cart
        const updatedCart = await cart.save();

        return res.json({
          data: updatedCart,
          message: "Successfully deleted product from cart",
        });
      }
    }
  } catch (err) {
    console.log("product index value error", err.message);
    return res.status(500).json({ error: err.message });
  }
};

exports.deleteCartByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Deleting entire cart for userId:", userId);

    const deletedCart = await Cart.findOneAndDelete({ userId: userId });

    if (!deletedCart) {
      return res.status(404).json({ message: "Cart not found for this user" });
    }

    return res.json({
      data: deletedCart,
      message: "Successfully deleted entire cart for user",
    });
  } catch (err) {
    console.log("Error deleting cart by userId:", err.message);
    return res.status(500).json({ error: err.message });
  }
};