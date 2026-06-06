const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: String, required: true },
    priceValue: { type: Number }, // numeric value for sorting/filtering
    img: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "clothing" },
    isOnSale: { type: Boolean, default: false },
    originalPrice: { type: String },
    inStock: { type: Boolean, default: true },
    sizes: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
