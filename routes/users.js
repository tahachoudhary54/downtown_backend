const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// GET current user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update current user
router.put("/me", auth, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // If email is being changed, check if it's already in use
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: "Email is already in use by another account" });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, { name, email }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update password
router.put("/me/password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide current and new password" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // For Google-auth users who don't have a password
    if (!user.password) {
      return res.status(400).json({ success: false, message: "Your account is linked to Google. Please set a password through reset password first." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect current password" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add a saved address
router.post("/me/addresses", auth, async (req, res) => {
  try {
    const { fullName, street, city, state, zip, phone, isDefault } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push({
      fullName, street, city, state, zip, phone, isDefault: isDefault || user.addresses.length === 0
    });

    await user.save();
    res.status(201).json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE a saved address
router.delete("/me/addresses/:addressId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.addressId);
    
    // If the default address was deleted, set the first one as default
    if (user.addresses.length > 0 && !user.addresses.some(addr => addr.isDefault)) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT set default address
router.put("/me/addresses/:addressId/default", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let found = false;
    user.addresses.forEach(addr => {
      if (addr._id.toString() === req.params.addressId) {
        addr.isDefault = true;
        found = true;
      } else {
        addr.isDefault = false;
      }
    });

    if (!found) return res.status(404).json({ success: false, message: "Address not found" });

    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET user wishlist
router.get("/me/wishlist", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user.wishlist || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update user wishlist
router.put("/me/wishlist", auth, async (req, res) => {
  try {
    const { wishlist } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.wishlist = Array.isArray(wishlist) ? wishlist : [];
    user.markModified('wishlist');
    await user.save();
    res.json({ success: true, data: user.wishlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST merge guest wishlist with user account wishlist upon login
router.post("/me/wishlist/merge", auth, async (req, res) => {
  try {
    const { guestWishlist } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const currentWishlist = user.wishlist || [];
    const localItems = Array.isArray(guestWishlist) ? guestWishlist : [];

    const isSame = (p1, p2) => {
      if (!p1 || !p2) return false;
      const id1 = p1._id || p1.id;
      const id2 = p2._id || p2.id;
      return id1 && id2 && id1.toString() === id2.toString();
    };

    const newItems = localItems.filter(
      (localP) => !currentWishlist.some((dbP) => isSame(dbP, localP))
    );

    if (newItems.length > 0) {
      user.wishlist = [...currentWishlist, ...newItems];
      user.markModified('wishlist');
      await user.save();
    }

    res.json({ success: true, data: user.wishlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all users (admin only)
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update user role (admin only)
router.put("/:id/role", auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE user (admin only)
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
