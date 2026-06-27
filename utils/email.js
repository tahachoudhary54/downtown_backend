const nodemailer = require("nodemailer");
const { google } = require("googleapis");

let transporter;

if (process.env.NODE_ENV === "production") {
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

/**
 * Send an email using the configured transporter.
 * If sending fails in development, it falls back to Ethereal.
 */
const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  const fromAddress = process.env.EMAIL_USER || "no-reply@localhost";
  const mailOptions = {
    from: `"Downtown Boutique" <${fromAddress}>`,
    replyTo: replyTo || fromAddress,
    to,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
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

module.exports = {
  sendEmail,
};
