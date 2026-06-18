const mongoose = require("mongoose");

const whatsappClickSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    productName: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WhatsAppClick", whatsappClickSchema);
