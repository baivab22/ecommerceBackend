const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    password: {
      type: String,
      required: true
    },

    name: {
      type: String,
      trim: true
    },

    picture: {
      type: String
    },

    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER"
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    emailVerified: {
      type: Boolean,
      default: false
    },

    // OAuth flags
    isGoogleUser: {
      type: Boolean,
      default: false
    },

    isFacebookUser: {
      type: Boolean,
      default: false
    },

    isTikTokUser: {
      type: Boolean,
      default: false
    },

    // OAuth IDs (no defaults)
    facebookId: {
      type: String,
      sparse: true
    },

    tiktokOpenId: {
      type: String,
      unique: true,
      sparse: true
    },

    tiktokUnionId: {
      type: String,
      unique: true,
      sparse: true
    },

    lastLoginAt: Date,

    loginCount: {
      type: Number,
      default: 0
    },

    resetPasswordToken: {
      type: String,
      sparse: true,
      index: true
    },

    resetPasswordExpires: Date
  },
  {
    timestamps: true
  }
);

//
// 🔥 AUTO-CLEAN null VALUES (NO CONTROLLER CHANGES)
//
userSchema.pre("save", function (next) {
  const nullableUniqueFields = [
    "facebookId",
    "tiktokOpenId",
    "tiktokUnionId",
    "resetPasswordToken"
  ];

  nullableUniqueFields.forEach((field) => {
    if (this[field] === null) {
      this[field] = undefined; // removes field from document
    }
  });

  next();
});

module.exports = mongoose.model("User", userSchema);
