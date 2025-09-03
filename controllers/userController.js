// const User = require("../modals/userModal");

// const express = require("express");
// const router = express.Router();

// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");

// // Register
// exports.registerUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "Please provide an email and password." });
//     }

//     const existingUser = await User.findOne({ email });

//     if (existingUser) {
//       return res.status(400).json({ message: "User already exists." });
//     }

//     // const hashedPassword = await bcrypt.hash(password, 10);
//     console.log("userData", email, password);
//     const user = new User({ email, password: password });
//     await user.save();

//     res.status(201).json({
//       data: user,
//       // userRoles: userRole,
//       message: "User registered successfully.",
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Registration failed." });
//   }
// };

// exports.loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const user = await User.findOne({ email });

//     console.log(email);

//     if (!user) {
//       return res.status(401).json({ message: "Invalid email or password." });
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({ message: "Invalid email or password." });
//     }
//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
//     let userRoles = "";

//     if (email === "meromail123@gmail.com" && password === "123456783") {
//       console.log("admin");
//       userRoles = "ADMIN";
//     } else {
//       userRoles = "USER";
//       console.log("non admin");
//     }

//     console.log("userRoles", userRoles, "role");

//     res.json({ token, user: user, userRoles: userRoles });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Login failed." });
//   }
// };
// const User = require("../modals/userModal");

const nodemailer = require("nodemailer");
const crypto = require("crypto");
const User = require("../modals/userModal");

const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const transporter = nodemailer.createTransport({
  service: "Gmail", // You can change this to your email provider
  auth: {
    user: "baivabbidari876@gmail.com", // Replace with your email
    pass: "djuw xkgi vbpi vwqc",
  },
});

// Register
exports.registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide an email and password." });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ email, password: hashedPassword });
    await user.save();

    res.status(201).json({
      data: user,
      // userRoles: userRole,
      message: "User registered successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Registration failed." });
  }
};

exports.loginUser = async (req, res) => {
  console.log("Login attempt initiated");
  
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required.",
        success: false 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: "Please provide a valid email address.",
        success: false 
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid email or password.",
        success: false 
      });
    }

    console.log("User found, verifying password");

    // Check if user account is active (if you have this field)
    if (user.status && user.status === 'inactive') {
      return res.status(403).json({ 
        message: "Your account is inactive. Please contact support.",
        success: false 
      });
    }

    // Compare password with hashed password in database
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid email or password.",
        success: false 
      });
    }

    console.log("Password verified successfully");

    // Determine user role
    let userRoles = "USER"; // Default role
    
    // Check for admin credentials or role from database
    if (user.role) {
      // If role is stored in database
      userRoles = user.role.toUpperCase();
    } else {
      // Fallback: Check for specific admin emails
      const adminEmails = [
        "meromail123@gmail.com",
        "adminemail12@gmail.com"
      ];
      
      if (adminEmails.includes(email.toLowerCase())) {
        userRoles = "ADMIN";
      }
    }

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || "4Kq#W%L9gT!z7&$xP@jR"; // Use environment variable
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: userRoles 
      },
      JWT_SECRET,
      { 
        expiresIn: '24h' // Token expires in 24 hours
      }
    );

    // Update last login timestamp (optional)
    await User.findByIdAndUpdate(user._id, { 
      lastLoginAt: new Date(),
      $inc: { loginCount: 1 } // Increment login counter if you have this field
    });

    // Prepare user data (exclude sensitive information)
    const userData = {
      _id: user._id,
      email: user.email,
      name: user.name || user.firstName + ' ' + user.lastName,
      role: userRoles,
      createdAt: user.createdAt,
      // Add other non-sensitive fields as needed
    };

    console.log(`User ${user.email} logged in successfully with role: ${userRoles}`);

    // Send successful response
    res.status(200).json({
      message: "Login successful",
      success: true,
      user: userData,
      userRoles: userRoles,
      token: token,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error("Login error:", error);
    
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
      message: "Internal server error. Please try again later.",
      success: false,
      ...(isDevelopment && { error: error.message, stack: error.stack })
    });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(400).json({
        message: "No token provided",
        success: false
      });
    }

    // Here you could add token to a blacklist if you're implementing that
    // await BlacklistedToken.create({ token });

    res.status(200).json({
      message: "Logged out successfully",
      success: true
    });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      message: "Logout failed",
      success: false
    });
  }
};



exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide an email." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set token and expiry on the user model
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    console.log(resetTokenHash, "resetTokenHash");

    const resetUrl = `http://localhost:3010/#/reset-password?resetToken=${resetToken}`;

    const mailOptions = {
      from: "baivabbidari876@gmail.com",
      to: user.email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Click the link to reset your password: ${resetUrl}. If you didn't request this, ignore this email.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Password reset email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to process forgot password request." });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res
        .status(400)
        .json({ message: "Please provide a reset token and a new password." });
    }

    // Hash the provided reset token
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Find the user based on the hashed token

    console.log(resetTokenHash, "resetTokenHash reset");
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      // resetPasswordExpires: { $gt: Date.now() }, // Token must be valid (not expired)
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // Hash the new password before saving it to the database
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the user's password and clear the reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined; // Clear the reset token
    user.resetPasswordExpires = undefined; // Clear the expiration

    await user.save();

    res.status(200).json({
      message: "Password successfully updated.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reset password." });
  }
};


// Helper function to verify JWT token (for middleware)
exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      message: "Access denied. No token provided.",
      success: false
    });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || "4Kq#W%L9gT!z7&$xP@jR";
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: "Token has expired. Please login again.",
        success: false
      });
    }
    
    return res.status(401).json({
      message: "Invalid token.",
      success: false
    });
  }
};