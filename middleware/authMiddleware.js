const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  // Get token from header
  const token = req.header("x-auth-token") || req.header("Authorization")?.replace("Bearer ", "");

  // Check if no token
  if (!token) {
    return res.status(401).json({ success: false, message: "No token, authorization denied" });
  }

  // Verify token
  try {
    const secret = process.env.JWT_SECRET || "fallback_secret_key_change_in_production";
    const decoded = jwt.verify(token, secret);

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Token is not valid" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ success: false, message: "Access denied. Admin only." });
  }
};

module.exports = { auth, adminOnly };
