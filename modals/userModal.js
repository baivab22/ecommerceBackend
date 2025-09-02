const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  resetPasswordToken: {
    type: String,
    default: null, // Initially null
  },
  resetPasswordExpires: {
    type: Date,
    default: null, // Initially null
  },
});
module.exports = mongoose.model("User", userSchema);
