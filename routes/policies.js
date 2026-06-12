const express = require("express");
const router = express.Router();
const Policy = require("../models/Policy");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// Helper to get or create policies doc
const getOrCreatePolicy = async () => {
  let policy = await Policy.findOne();
  if (!policy) {
    policy = new Policy();
    await policy.save();
  }
  return policy;
};

// GET /api/policies - Public
router.get("/", async (req, res) => {
  try {
    const policy = await getOrCreatePolicy();
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/policies - Admin Only
router.put("/", auth, adminOnly, async (req, res) => {
  try {
    let policy = await getOrCreatePolicy();
    
    // Update fields
    const fields = [
      'aboutUs', 'contactUs', 'termsAndConditions', 
      'privacyPolicy', 'shippingAndReturns', 'sizeGuide', 'faq'
    ];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        policy[field] = req.body[field];
      }
    });

    await policy.save();

    // Emit real-time policy update
    const io = req.app.get("io");
    if (io) {
      io.emit("policies_updated", policy);
    }

    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
