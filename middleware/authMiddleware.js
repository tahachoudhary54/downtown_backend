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

    if (decoded.user.loginType === "admin") {
      return res.status(403).json({ success: false, message: "Admin tokens cannot be used for user routes" });
    }

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Token is not valid" });
  }
};

const adminAuth = (req, res, next) => {
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

    if (decoded.user.loginType !== "admin") {
      return res.status(403).json({ success: false, message: "User tokens cannot be used for admin routes" });
    }

    if (decoded.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. Admin only." });
    }

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Token is not valid" });
  }
};

const authOrAdmin = (req, res, next) => {
  const token = req.header("x-auth-token") || req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "No token, authorization denied" });

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
  // Kept for backwards compatibility just in case, but unused by new routes
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ success: false, message: "Access denied. Admin only." });
  }
};

module.exports = { auth, adminAuth, authOrAdmin, adminOnly };
