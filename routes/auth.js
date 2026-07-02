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
  const mailOptions = {
    from: `"Downtown Boutique" <${fromAddress}>`,
    replyTo: fromAddress,
    to: email,
    subject: "Your Verification Code - Downtown Boutique",
    text: `Your Verification Code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an account, please ignore this email.`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email – Downtown Boutique</title>
</head>
<body style="margin:0; padding:0; background-color:#0d0d0d; font-family:'Inter','Poppins',Arial,sans-serif; -webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d; padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Email Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#111111; border-radius:16px; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,0.6);">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#111111 0%,#1a1a1a 100%); padding:40px 40px 32px; text-align:center; border-bottom:1px solid #222;">
              <!-- Brand name as text (no broken image) -->
              <p style="margin:0 0 4px; font-size:11px; font-weight:700; letter-spacing:4px; color:#c8a96e; text-transform:uppercase;">Downtown</p>
              <p style="margin:0; font-size:26px; font-weight:800; letter-spacing:2px; color:#ffffff; text-transform:uppercase; line-height:1;">BOUTIQUE</p>
              <div style="width:48px; height:2px; background:linear-gradient(90deg,#c8a96e,#e8c97e); margin:16px auto 0; border-radius:1px;"></div>
            </td>
          </tr>

          <!-- ── HERO SECTION ── -->
          <tr>
            <td style="padding:44px 40px 32px; text-align:center;">
              <!-- Lock icon (table-based centering for email compatibility) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:64px; height:64px; background:linear-gradient(135deg,#1e1e1e,#2a2a2a); border-radius:50%; border:1px solid #2e2e2e; text-align:center; vertical-align:middle;">
                          <span style="font-size:28px; line-height:64px; display:block;">🔒</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 16px; font-size:26px; font-weight:700; color:#ffffff; letter-spacing:-0.3px; line-height:1.3;">
                Verify Your Email Address
              </h1>
              <p style="margin:0; font-size:15px; color:#888888; line-height:1.7; max-width:400px; margin-left:auto; margin-right:auto;">
                Thank you for creating your Downtown Boutique account. Enter the verification code below to continue.
              </p>
            </td>
          </tr>

          <!-- ── OTP CARD ── -->
          <tr>
            <td style="padding:0 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#1a1a1a; border:1px solid #2a2a2a; border-radius:14px; padding:32px 24px; text-align:center; box-shadow:0 8px 32px rgba(0,0,0,0.4);">
                    <p style="margin:0 0 20px; font-size:11px; font-weight:700; letter-spacing:3px; color:#c8a96e; text-transform:uppercase;">Your Verification Code</p>

                    <!-- OTP digits -->
                    <div style="display:inline-block; background:#111111; border:1px solid #2e2e2e; border-radius:12px; padding:18px 36px; margin-bottom:20px;">
                      <span style="font-size:40px; font-weight:800; letter-spacing:10px; color:#ffffff; font-family:'Courier New',Courier,monospace; line-height:1;">${otp}</span>
                    </div>

                    <p style="margin:0; font-size:13px; color:#555555; letter-spacing:0.3px;">
                      ⏱ This code expires in <strong style="color:#c8a96e;">10 minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── SECURITY NOTICE ── -->
          <tr>
            <td style="padding:0 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#161616; border-left:3px solid #c8a96e; border-radius:0 8px 8px 0; padding:14px 18px;">
                    <p style="margin:0; font-size:13px; color:#666666; line-height:1.6;">
                      🔐 <strong style="color:#888888;">Security Notice:</strong> If you didn't create a Downtown Boutique account, please ignore this email. No action is required.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── DIVIDER ── -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px; background:linear-gradient(90deg,transparent,#222,transparent);"></div>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:28px 40px 36px; text-align:center;">
              <p style="margin:0 0 12px; font-size:11px; font-weight:700; letter-spacing:3px; color:#333333; text-transform:uppercase;">Downtown Boutique</p>
              <p style="margin:0 0 16px; font-size:12px; color:#444444; line-height:1.6;">
                Premium Men's Fashion &nbsp;|&nbsp; Est. 2024
              </p>
              <p style="margin:0; font-size:11px; color:#333333; line-height:2;">
                <a href="mailto:support@downtownboutique.com" style="color:#c8a96e; text-decoration:none; margin:0 10px;">Contact Support</a>
                <span style="color:#2e2e2e;">|</span>
                <a href="https://downtownboutique.com/privacy" style="color:#c8a96e; text-decoration:none; margin:0 10px;">Privacy Policy</a>
              </p>
              <p style="margin:20px 0 0; font-size:11px; color:#2e2e2e;">© 2026 Downtown Boutique. All rights reserved.</p>
            </td>
          </tr>

        </table>
        <!-- /Email Card -->

      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  return sendEmail({
    to: email,
    subject: "Your Verification Code - Downtown Boutique",
    text: `Your Verification Code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an account, please ignore this email.`,
    html: mailOptions.html
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
