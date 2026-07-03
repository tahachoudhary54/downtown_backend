const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { sendEmail } = require("../utils/email");
const crypto = require("crypto");

const generateTokens = async (user, res, loginType = "user") => {
  const payload = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      loginType,
    }
  };
  const secret = process.env.JWT_SECRET || "fallback_secret_key_change_in_production";
  const accessToken = jwt.sign(payload, secret, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, secret, { expiresIn: "30d" });

  const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
  await User.updateOne(
    { _id: user.id },
    { $push: { refreshTokens: { $each: [hashedToken], $slice: -20 } } }
  );

  const cookieName = loginType === "admin" ? "adminRefreshToken" : "refreshToken";
  res.cookie(cookieName, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  return accessToken;
};
// Helper function to send OTP email with fallback to Ethereal (development)
const sendOtpEmail = async (email, otp) => {
  const fromAddress = process.env.EMAIL_USER || "no-reply@localhost";
  
  // Keep it extremely simple to avoid triggering Gmail's strict spam filters
  // for automated emails sent from a @gmail.com address.
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Verification Code</h2>
      <p>Thank you for creating an account with us.</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <h1 style="margin: 0; letter-spacing: 5px;">${otp}</h1>
      </div>
      <p>This code expires in 10 minutes.</p>
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        If you didn't request this code, please ignore this email.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Verification Code",
    text: `Your Verification Code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an account, please ignore this email.`,
    html: htmlContent
  });
};

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Please provide all fields" });
    }

    let user = await User.findOne({ email });

    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ success: false, message: "User already exists" });
      }
    } else {
      user = new User({ name, email });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.isVerified = false;

    await user.save();

    // Send OTP email
    const emailResult = await sendOtpEmail(user.email, otp);

    const response = { success: true, message: "OTP sent to your email" };
    if (emailResult && emailResult.previewUrl) {
      response.previewUrl = emailResult.previewUrl;
    }

    res.status(201).json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "User is already verified" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    // Verification successful
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = await generateTokens(user, res);
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    // generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();
    // send email and await result
    const emailResult = await sendOtpEmail(user.email, otp);
    console.log(`Resent OTP email to ${email}`);
    const response = { success: true, message: "OTP resent to your email" };
    if (emailResult && emailResult.previewUrl) {
      response.previewUrl = emailResult.previewUrl;
    }
    return res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password, loginType = "user" } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    if (loginType === "admin" && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. Admin only." });
    }

    // Check if verified
    if (!user.isVerified) {
      return res.status(400).json({ success: false, message: "Please verify your email first" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const token = await generateTokens(user, res, loginType);
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { credential, loginType = "user" } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: "No credential provided" });
    }

    let payload;
    
    if (process.env.NODE_ENV === "production") {
      // PRODUCTION: Strictly verify the Google signature to prevent forged tokens
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      // DEVELOPMENT: Decode without signature verification to avoid local clock-skew errors
      payload = jwt.decode(credential);
      if (!payload || payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res.status(400).json({ success: false, message: "Invalid Google token or audience mismatch" });
      }
    }

    const { email, name } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        isVerified: true,
      });
      await user.save();
    } else if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    if (loginType === "admin" && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. Admin only." });
    }

    const token = await generateTokens(user, res, loginType);
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Google Auth Error:", err.message);
    res.status(500).json({ success: false, message: "Auth failed" });
  }
});



// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // For Google-auth users who don't have a password set yet, we allow them to set one via reset password
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = otpExpires;
    await user.save();

    // Send email using existing helper (subject and text might be slightly different but works fine for OTP)
    const emailResult = await sendOtpEmail(user.email, otp);

    const response = { success: true, message: "Password reset OTP sent to your email" };
    if (emailResult && emailResult.previewUrl) {
      response.previewUrl = emailResult.previewUrl;
    }

    res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide all fields" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Clear OTP fields
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    
    // Also set isVerified to true just in case they weren't verified before
    user.isVerified = true;

    await user.save();

    res.json({ success: true, message: "Password has been reset successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/auth/refresh
router.get("/refresh", async (req, res) => {
  try {
    const type = req.query.type === "admin" ? "admin" : "user";
    const cookieName = type === "admin" ? "adminRefreshToken" : "refreshToken";
    const refreshToken = req.cookies[cookieName];
    
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "No refresh token provided" });
    }

    const secret = process.env.JWT_SECRET || "fallback_secret_key_change_in_production";
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    }
    
    if (decoded.user.loginType !== type) {
      return res.status(401).json({ success: false, message: "Token type mismatch" });
    }
    
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    if (!user.refreshTokens) user.refreshTokens = [];
    const tokenIndex = user.refreshTokens.indexOf(hashedToken);

    if (tokenIndex === -1) {
      // THEFT DETECTED: A valid but unrecorded refresh token was used.
      // Wipe all refresh tokens to force re-login on all devices.
      await User.updateOne({ _id: user.id }, { $set: { refreshTokens: [] } });
      res.clearCookie(cookieName);
      return res.status(401).json({ success: false, message: "Refresh token rotation anomaly detected. Session revoked." });
    }

    // Valid token. Remove it atomically
    await User.updateOne(
      { _id: user.id },
      { $pull: { refreshTokens: hashedToken } }
    );
    
    const token = await generateTokens(user, res, type);
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Refresh token error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const type = req.query.type === "admin" ? "admin" : "user";
  const cookieName = type === "admin" ? "adminRefreshToken" : "refreshToken";
  const refreshToken = req.cookies[cookieName];
  
  if (refreshToken) {
    try {
      const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
      const secret = process.env.JWT_SECRET || "fallback_secret_key_change_in_production";
      const decoded = jwt.verify(refreshToken, secret);
      const user = await User.findById(decoded.user.id);
      if (user) {
        await User.updateOne({ _id: user.id }, { $pull: { refreshTokens: hashedToken } });
      }
    } catch (err) {
      // Ignore invalid tokens on logout
    }
  }
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  res.json({ success: true, message: "Logged out successfully" });
});

module.exports = router;
