const mongoose = require("mongoose");

const savedOutfitSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        products: [{ type: mongoose.Schema.Types.Mixed }], // Stores full product payload or just IDs. To avoid query limits, mixed is fine since we store what AI returned.
        priceText: { type: String }, // e.g. "₹4,999"
        previewImages: [{ type: String }],
    },
    { timestamps: true }
);

module.exports = mongoose.model("SavedOutfit", savedOutfitSchema);
