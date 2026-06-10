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
    sku: { type: String, default: "" },
    inventory: {
      type: Map,
      of: Number,
      default: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 }
    },
    stock: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    sizes: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
