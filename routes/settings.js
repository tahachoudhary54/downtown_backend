const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// Helper to get or create settings
const getOrCreateSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = new Settings();
    await settings.save();
  }
  return settings;
};

// GET /api/settings - Public
router.get("/", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings - Admin Only
router.put("/", auth, adminOnly, async (req, res) => {
  try {
    let settings = await getOrCreateSettings();
    
    // Update fields
    if (req.body.hero) settings.hero = { ...settings.hero.toObject(), ...req.body.hero };
    if (req.body.seasonalBanner) settings.seasonalBanner = { ...settings.seasonalBanner.toObject(), ...req.body.seasonalBanner };
    if (req.body.categories) settings.categories = req.body.categories;
    if (req.body.store) settings.store = { ...settings.store.toObject(), ...req.body.store };
    if (req.body.whatsapp) settings.whatsapp = { ...settings.whatsapp?.toObject?.() || settings.whatsapp || {}, ...req.body.whatsapp };

    await settings.save();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
