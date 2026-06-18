const express = require("express");
const router = express.Router();
const WhatsAppClick = require("../models/WhatsAppClick");

// POST /api/analytics/whatsapp-click - Public
router.post("/whatsapp-click", async (req, res) => {
  try {
    const { url, productName } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: "URL is required" });
    }

    const click = new WhatsAppClick({
      url,
      productName: productName || null,
    });

    await click.save();

    res.status(201).json({ success: true, data: click });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
