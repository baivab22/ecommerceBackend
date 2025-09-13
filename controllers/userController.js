

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
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Save token & expiry
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Determine frontend URL based on environment
    const isProduction = process.env.NODE_ENV === "production";
    const frontendURL = isProduction
      ? process.env.CLIENT_URL_PROD
      : process.env.CLIENT_URL;

    if (!frontendURL) {
      console.error("CLIENT_URL is not defined in .env");
      return res.status(500).json({ message: "Server misconfigured" });
    }

    // Build hash route reset link
    const resetLink = `${frontendURL}/#/reset-password?resetToken=${resetToken}`;

    // Send email
    await transporter.sendMail({
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h3>Password Reset</h3>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 15 minutes.</p>
      `,
    });

    return res.json({ message: "Password reset link sent to email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword || newPassword.trim() === "") {
    return res.status(400).json({ message: "Reset token and new password are required" });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);

    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Server error" });
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