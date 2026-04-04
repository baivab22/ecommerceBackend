const crypto = require("crypto");
const User = require("../modals/userModal");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require('google-auth-library');
const Orders = require("../modals/orderModal");
const axios = require('axios'); // Add this for Facebook API calls
const { EMAIL_CONFIG, transporter } = require("../services/mailConfig");
const {
  getLogoAttachment,
  getLogoMarkup,
  buildEmailShell,
} = require('../services/emailTemplate');
const {
  buildInvoiceHtml,
  generateInvoicePngBuffer,
} = require('../services/invoiceRenderer.service');

// Initialize Google OAuth client
const client = new OAuth2Client('58815171868-hlpv60089h5p8286562i2bde9htijb74.apps.googleusercontent.com');

// Helper function to generate JWT token
const generateToken = (user, role) => {
  const JWT_SECRET = process.env.JWT_SECRET || "4Kq#W%L9gT!z7&$xP@jR";
  return jwt.sign(
    { 
      userId: user._id,
      email: user.email,
      role: role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Helper function to determine user role
const determineUserRole = (user, email) => {
  if (user.role) {
    return user.role.toUpperCase();
  }
  
  const adminEmails = [
    "meromail123@gmail.com",
    "adminemail12@gmail.com"
  ];
  
  return adminEmails.includes(email.toLowerCase()) ? "ADMIN" : "USER";
};

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
      message: "User registered successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Registration failed." });
  }
};

// ==================== REGULAR LOGIN ====================
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

    // Check if user account is active
    if (user.status && user.status === 'inactive') {
      return res.status(403).json({ 
        message: "Your account is inactive. Please contact support.",
        success: false 
      });
    }

    console.log("Password verified successfully");
    
    // Compare password with hashed password in database
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid email or password.",
        success: false 
      });
    }

    // Determine user role
    const userRoles = determineUserRole(user, email);

    // Generate JWT token
    const token = generateToken(user, userRoles);

    // Update last login timestamp
    await User.findByIdAndUpdate(user._id, { 
      lastLoginAt: new Date(),
      $inc: { loginCount: 1 }
    });

    // Prepare user data
    const userData = {
      _id: user._id,
      email: user.email,
      name: user.name || '',
      picture: user.picture || '',
      role: userRoles,
      createdAt: user.createdAt,
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
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
      message: "Internal server error. Please try again later.",
      success: false,
      ...(isDevelopment && { error: error.message, stack: error.stack })
    });
  }
};

// ==================== GOOGLE LOGIN ====================
exports.googleLogin = async (req, res) => {
  console.log("🔵 Google login endpoint hit!");
  console.log("🔵 Request body:", req.body);
  
  try {
    const { googleToken, name, picture } = req.body;

    if (!googleToken) {
      console.log("❌ No Google token provided");
      return res.status(400).json({
        message: "Google token is required.",
        success: false
      });
    }

    console.log("✅ Google token received, verifying...");

    // Verify Google token
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
      console.log("✅ Google token verified successfully");
      console.log("🔵 Google user email:", payload.email);
    } catch (googleError) {
      console.error("❌ Google verification error:", googleError);
      return res.status(401).json({
        message: "Invalid Google token. Please try again.",
        success: false,
        error: googleError.message
      });
    }

    const googleEmail = payload.email;
    const googleName = payload.name;
    const googlePicture = payload.picture;
    const emailVerified = payload.email_verified;

    console.log("🔵 Looking for user with email:", googleEmail);

    // Find or create user
    let user = await User.findOne({ email: googleEmail.toLowerCase().trim() });

    if (!user) {
      console.log("🔵 User not found, creating new user for Google login");
      
      // Create new user for Google login
      user = new User({
        email: googleEmail.toLowerCase().trim(),
        name: name || googleName,
        picture: picture || googlePicture,
        isGoogleUser: true,
        role: 'USER',
        emailVerified: emailVerified || true,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
      });
      await user.save();
      console.log("✅ New user created successfully");
    } else {
      console.log("✅ Existing user found");
      
      // Update user info if needed
      let needsUpdate = false;
      
      if (!user.isGoogleUser) {
        user.isGoogleUser = true;
        needsUpdate = true;
      }
      if (!user.picture && googlePicture) {
        user.picture = googlePicture;
        needsUpdate = true;
      }
      if (!user.name && googleName) {
        user.name = googleName;
        needsUpdate = true;
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        console.log("✅ User info updated");
      }
    }

    // Determine user role
    const userRoles = determineUserRole(user, googleEmail);
    console.log("🔵 User role determined:", userRoles);

    // Update role if it's an admin email
    if (userRoles === 'ADMIN' && user.role !== 'ADMIN') {
      user.role = 'ADMIN';
      await user.save();
      console.log("✅ User role updated to ADMIN");
    }

    // Generate JWT token
    const token = generateToken(user, userRoles);

    // Update last login
    await User.findByIdAndUpdate(user._id, { 
      lastLoginAt: new Date(),
      $inc: { loginCount: 1 }
    });

    const userData = {
      _id: user._id,
      email: user.email,
      name: user.name || googleName,
      picture: user.picture || googlePicture,
      role: userRoles,
      createdAt: user.createdAt,
    };

    console.log(`✅ Google user ${user.email} logged in successfully with role: ${userRoles}`);

    return res.status(200).json({
      message: "Login successful",
      success: true,
      user: userData,
      userRoles: userRoles,
      token: token,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error("❌ Google login error:", error);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
      message: "Internal server error. Please try again later.",
      success: false,
      ...(isDevelopment && { error: error.message, stack: error.stack })
    });
  }
};

// ==================== FACEBOOK LOGIN ====================
exports.facebookLogin = async (req, res) => {
  console.log("🟦 Facebook login endpoint hit!");
  console.log("🟦 Request body:", req.body);
  
  try {
    const { accessToken, userID, name, email, picture } = req.body;

    if (!accessToken || !userID) {
      console.log("❌ No Facebook access token or userID provided");
      return res.status(400).json({
        message: "Facebook access token and userID are required.",
        success: false
      });
    }

    console.log("✅ Facebook access token received, verifying...");

    // Verify Facebook token by calling Facebook Graph API
    let facebookData;
    try {
      const response = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );
      facebookData = response.data;
      
      console.log("✅ Facebook token verified successfully");
      console.log("🟦 Facebook user data:", facebookData);

      // Verify that the userID matches
      if (facebookData.id !== userID) {
        throw new Error("UserID mismatch");
      }
    } catch (facebookError) {
      console.error("❌ Facebook verification error:", facebookError);
      return res.status(401).json({
        message: "Invalid Facebook token. Please try again.",
        success: false,
        error: facebookError.message
      });
    }

    // Extract user information from Facebook data
    const facebookEmail = email || facebookData.email;
    const facebookName = name || facebookData.name;
    const facebookPicture = picture || facebookData.picture?.data?.url;
    const facebookId = facebookData.id;

    console.log("🟦 Facebook email:", facebookEmail);
    console.log("🟦 Facebook name:", facebookName);

    // If no email provided by Facebook, use a placeholder or require it
    if (!facebookEmail) {
      return res.status(400).json({
        message: "Email is required. Please grant email permission to Facebook.",
        success: false
      });
    }

    console.log("🟦 Looking for user with email:", facebookEmail);

    // Find or create user
    let user = await User.findOne({ 
      $or: [
        { email: facebookEmail.toLowerCase().trim() },
        { facebookId: facebookId }
      ]
    });

    if (!user) {
      console.log("🟦 User not found, creating new user for Facebook login");
      
      // Create new user for Facebook login
      user = new User({
        email: facebookEmail.toLowerCase().trim(),
        name: facebookName,
        picture: facebookPicture,
        facebookId: facebookId,
        isFacebookUser: true,
        role: 'USER',
        emailVerified: true, // Facebook emails are typically verified
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
      });
      await user.save();
      console.log("✅ New user created successfully");
    } else {
      console.log("✅ Existing user found");
      
      // Update user info if needed
      let needsUpdate = false;
      
      if (!user.isFacebookUser) {
        user.isFacebookUser = true;
        needsUpdate = true;
      }
      if (!user.facebookId) {
        user.facebookId = facebookId;
        needsUpdate = true;
      }
      if (!user.picture && facebookPicture) {
        user.picture = facebookPicture;
        needsUpdate = true;
      }
      if (!user.name && facebookName) {
        user.name = facebookName;
        needsUpdate = true;
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        console.log("✅ User info updated");
      }
    }

    // Determine user role
    const userRoles = determineUserRole(user, facebookEmail);
    console.log("🟦 User role determined:", userRoles);

    // Update role if it's an admin email
    if (userRoles === 'ADMIN' && user.role !== 'ADMIN') {
      user.role = 'ADMIN';
      await user.save();
      console.log("✅ User role updated to ADMIN");
    }

    // Generate JWT token
    const token = generateToken(user, userRoles);

    // Update last login
    await User.findByIdAndUpdate(user._id, { 
      lastLoginAt: new Date(),
      $inc: { loginCount: 1 }
    });

    const userData = {
      _id: user._id,
      email: user.email,
      name: user.name || facebookName,
      picture: user.picture || facebookPicture,
      role: userRoles,
      createdAt: user.createdAt,
    };

    console.log(`✅ Facebook user ${user.email} logged in successfully with role: ${userRoles}`);

    return res.status(200).json({
      message: "Login successful",
      success: true,
      user: userData,
      userRoles: userRoles,
      token: token,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error("❌ Facebook login error:", error);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
      message: "Internal server error. Please try again later.",
      success: false,
      ...(isDevelopment && { error: error.message, stack: error.stack })
    });
  }
};



exports.tiktokLogin = async (req, res) => {
  console.log("⚫ TikTok login endpoint hit!");
  console.log("⚫ Request body:", req.body);
  
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      console.log("❌ No TikTok authorization code provided");
      return res.status(400).json({
        message: "TikTok authorization code is required.",
        success: false
      });
    }

    console.log("✅ TikTok code received, exchanging for access token...");

    const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || 'YOUR_TIKTOK_CLIENT_KEY';
    const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || 'YOUR_TIKTOK_CLIENT_SECRET';

    // Step 1: Exchange authorization code for access token
    let tokenData;
    try {
      const tokenResponse = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        new URLSearchParams({
          client_key: TIKTOK_CLIENT_KEY,
          client_secret: TIKTOK_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      tokenData = tokenResponse.data;
      console.log("✅ TikTok access token obtained successfully");
    } catch (tokenError) {
      console.error("❌ TikTok token exchange error:", tokenError.response?.data || tokenError.message);
      return res.status(401).json({
        message: "Failed to exchange TikTok authorization code.",
        success: false,
        error: tokenError.response?.data || tokenError.message
      });
    }

    const accessToken = tokenData.access_token;
    const openId = tokenData.open_id;

    console.log("⚫ TikTok openId:", openId);

    // Step 2: Get user information using access token
    let tiktokUserData;
    try {
      const userInfoResponse = await axios.get(
        'https://open.tiktokapis.com/v2/user/info/',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            fields: 'open_id,union_id,avatar_url,display_name'
          }
        }
      );
      
      tiktokUserData = userInfoResponse.data.data.user;
      console.log("✅ TikTok user info retrieved successfully");
      console.log("⚫ TikTok user data:", tiktokUserData);
    } catch (userInfoError) {
      console.error("❌ TikTok user info error:", userInfoError.response?.data || userInfoError.message);
      return res.status(401).json({
        message: "Failed to retrieve TikTok user information.",
        success: false,
        error: userInfoError.response?.data || userInfoError.message
      });
    }

    // Extract user information
    const tiktokOpenId = tiktokUserData.open_id;
    const tiktokName = tiktokUserData.display_name;
    const tiktokPicture = tiktokUserData.avatar_url;
    const tiktokUnionId = tiktokUserData.union_id;

    console.log("⚫ TikTok display name:", tiktokName);

    // TikTok doesn't provide email by default, so we'll use openId as unique identifier
    // Create a unique email placeholder if needed
    const placeholderEmail = `tiktok_${tiktokOpenId}@tiktok-user.local`;

    console.log("⚫ Looking for user with TikTok openId:", tiktokOpenId);

    // Find or create user
    let user = await User.findOne({
      $or: [
        { tiktokOpenId: tiktokOpenId },
        { tiktokUnionId: tiktokUnionId }
      ]
    });

    if (!user) {
      console.log("⚫ User not found, creating new user for TikTok login");
      
      // Create new user for TikTok login
      user = new User({
        email: placeholderEmail,
        name: tiktokName,
        picture: tiktokPicture,
        tiktokOpenId: tiktokOpenId,
        tiktokUnionId: tiktokUnionId,
        isTikTokUser: true,
        role: 'USER',
        emailVerified: false, // TikTok doesn't provide email
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
      });
      await user.save();
      console.log("✅ New user created successfully");
    } else {
      console.log("✅ Existing user found");
      
      // Update user info if needed
      let needsUpdate = false;
      
      if (!user.isTikTokUser) {
        user.isTikTokUser = true;
        needsUpdate = true;
      }
      if (!user.tiktokOpenId) {
        user.tiktokOpenId = tiktokOpenId;
        needsUpdate = true;
      }
      if (!user.tiktokUnionId && tiktokUnionId) {
        user.tiktokUnionId = tiktokUnionId;
        needsUpdate = true;
      }
      if (!user.picture && tiktokPicture) {
        user.picture = tiktokPicture;
        needsUpdate = true;
      }
      if (!user.name && tiktokName) {
        user.name = tiktokName;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        console.log("✅ User info updated");
      }
    }

    // Determine user role (TikTok users are typically regular users)
    const userRoles = determineUserRole(user, user.email);
    console.log("⚫ User role determined:", userRoles);

    // Generate JWT token
    const token = generateToken(user, userRoles);

    // Update last login
    await User.findByIdAndUpdate(user._id, { 
      lastLoginAt: new Date(),
      $inc: { loginCount: 1 }
    });

    const userData = {
      _id: user._id,
      email: user.email,
      name: user.name || tiktokName,
      picture: user.picture || tiktokPicture,
      role: userRoles,
      createdAt: user.createdAt,
    };

    console.log(`✅ TikTok user ${user.name} logged in successfully with role: ${userRoles}`);

    return res.status(200).json({
      message: "Login successful",
      success: true,
      user: userData,
      userRoles: userRoles,
      token: token,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error("❌ TikTok login error:", error);
    
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
      from: EMAIL_CONFIG.sender,
      to: user.email,
      subject: "Password Reset Request",
      html: buildEmailShell({
        subject: 'Password Reset Request',
        title: 'Password Reset Request',
        subtitle: 'Secure account access',
        bodyHtml: `
          <p>We received a request to reset your password.</p>
          <p>Click the secure link below to create a new password:</p>
          <p style="margin: 14px 0; word-break: break-all;">
            <a href="${resetLink}" style="color:#2563eb; text-decoration:none;">${resetLink}</a>
          </p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
        footerNote: 'For your security, this link expires automatically.',
        contactPhone: '9861698400',
        contactEmail: EMAIL_CONFIG.sender,
      }),
      attachments: getLogoAttachment(),
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



exports.sendInvoiceEmail = async (req, res) => {
  try {
    const { orderId, customerEmail, customerName } = req.body;

    // Validate required fields
    if (!orderId || !customerEmail) {
      return res.status(400).json({
        success: false,
        message: "Order ID and customer email are required"
      });
    }

    // Find the order with populated references
    const order = await Orders.findById(orderId)
      .populate('userId')
      .populate('products.productId');

    console.log("Order found for invoice email:", order);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const emailHtml = buildInvoiceHtml({
      order,
      customerEmail,
      customerName,
      senderEmail: EMAIL_CONFIG.sender,
      title: 'Invoice',
    });

    const invoicePng = await generateInvoicePngBuffer({
      order,
      customerEmail,
      customerName,
      senderEmail: EMAIL_CONFIG.sender,
      title: 'Invoice',
    });

    const attachments = [...getLogoAttachment()];
    if (invoicePng) {
      attachments.push({
        filename: `invoice-${order.productOrderId || order._id.toString().slice(-8).toUpperCase()}.png`,
        content: invoicePng,
        contentType: 'image/png',
      });
    }

    // Send email using transporter
    await transporter.sendMail({
      from: EMAIL_CONFIG.sender,
      to: customerEmail,
      subject: `Invoice #${order.productOrderId || order._id.toString().slice(-8).toUpperCase()}`,
      html: emailHtml,
      attachments,
    });

    console.log(`Invoice email sent successfully to ${customerEmail} for order ${orderId}`);

    return res.status(200).json({
      success: true,
      message: "Invoice sent successfully to customer email"
    });

  } catch (error) {
    console.error("Error sending invoice email:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send invoice email",
      error: error.message
    });
  }
};
