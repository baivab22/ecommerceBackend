const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  name: {
    type: String,
    default: ''
  },
  picture: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['USER', 'ADMIN'],
    default: 'USER'
  },
  // Google OAuth fields
  isGoogleUser: {
    type: Boolean,
    default: false
  },
  // Facebook OAuth fields
  isFacebookUser: {
    type: Boolean,
    default: false
  },
  facebookId: {
    type: String,
    default: null,
    sparse: true // This allows multiple documents with null values for facebookId
    // Removed unique: true to allow duplicates or null values
  },
  // TikTok OAuth fields
  isTikTokUser: {
    type: Boolean,
    default: false
  },
  tiktokOpenId: {
    type: String,
    default: null,
    unique: true,
    sparse: true
  },
  tiktokUnionId: {
    type: String,
    default: null,
    unique: true,
    sparse: true
  },
  // Common fields
  emailVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
