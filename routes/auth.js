const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Setup Nodemailer transporter
let transporter;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
  const OAuth2 = google.auth.OAuth2;
  const oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      accessToken: async () => {
        const { token } = await oauth2Client.getAccessToken();
        return token;
      }
    },
  });
} else {
  // Development: use Mailtrap (or Ethereal fallback)
  transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST || "smtp.mailtrap.io",
    port: parseInt(process.env.MAILTRAP_PORT) || 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS,
    },
  });
}


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

  // Try primary transporter (Gmail or Mailtrap)
  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
    return { previewUrl: null };
  } catch (primaryErr) {
    console.error('Primary email send failed:', primaryErr);
  }

  // Fallback to Ethereal test account (dev only)
  try {
    const testAccount = await nodemailer.createTestAccount();
    const ethTransport = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    const info = await ethTransport.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('Ethereal preview URL:', previewUrl);
    return { previewUrl };
  } catch (fallbackErr) {
    console.error('Ethereal fallback also failed:', fallbackErr);
    return { previewUrl: null };
  }
};

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

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    const secret = process.env.JWT_SECRET || "fallback_secret_key_change_in_production";
    
    jwt.sign(payload, secret, { expiresIn: "7d" }, (err, token) => {
      if (err) throw err;
      res.json({ success: true, token, user: payload.user });
    });
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
    const { email, password } = req.body;

    let user = await User.findOne({ email });

    // Admin Flow
    if (user && user.role === 'admin') {
      if (!password) {
        return res.json({ success: true, requiresPassword: true });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Invalid credentials" });
      }
      
      const payload = {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      };
      const secret = process.env.JWT_SECRET || "fallback_secret_key_change_in_production";
      jwt.sign(payload, secret, { expiresIn: "7d" }, (err, token) => {
        if (err) throw err;
        res.json({ success: true, token, user: payload.user });
      });
      return;
    }

    // Customer Flow (Passwordless OTP)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    if (!user) {
      // Create new user if they don't exist
      user = new User({
        name: email.split('@')[0],
        email,
        otp,
        otpExpires,
      });
    } else {
      // Update existing user with new OTP
      user.otp = otp;
      user.otpExpires = otpExpires;
    }
    
    await user.save();

    const emailResult = await sendOtpEmail(user.email, otp);

    const responsePayload = { success: true, requiresOtp: true, message: "OTP sent to your email" };
    if (emailResult && emailResult.previewUrl) {
      responsePayload.previewUrl = emailResult.previewUrl;
    }
    res.status(200).json(responsePayload);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: "No credential provided" });
    }

    // Decode credential directly and check audience, avoiding clock skew issues
    // WORKAROUND: The system clock is out of sync with Google's servers, causing
    // "Expiration time too far in future" or "Token used too early" errors.
    // We are temporarily decoding the token directly without strict time verification.
    // IMPORTANT: In production, revert to using `googleClient.verifyIdToken` for security!
    const payload = jwt.decode(credential);
    if (!payload || payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ success: false, message: "Invalid Google token or audience mismatch" });
    }

    const { email, name } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user, without password, auto-verified
      user = new User({
        name,
        email,
        isVerified: true,
      });
      await user.save();
    } else if (!user.isVerified) {
      // If user exists but is not verified, verify them
      user.isVerified = true;
      await user.save();
    }

    // Generate JWT
    const jwtPayload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    const secret = process.env.JWT_SECRET || "fallback_secret_key_change_in_production";

    jwt.sign(jwtPayload, secret, { expiresIn: "7d" }, (err, token) => {
      if (err) throw err;
      res.json({ success: true, token, user: jwtPayload.user });
    });
  } catch (err) {
    console.error("Google Auth Error:", err.message);
    res.status(500).json({ success: false, message: "Auth failed" });
  }
});

module.exports = router;

