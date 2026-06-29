const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: false },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    addresses: [
      {
        fullName: { type: String },
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zip: { type: String },
        phone: { type: String },
        isDefault: { type: Boolean, default: false }
      }
    ],
    wishlist: [{ type: mongoose.Schema.Types.Mixed, default: [] }],
    shoppingPreferences: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
