const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: String, required: true },
    priceValue: { type: Number }, // numeric value for sorting/filtering
    img: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "clothing" },
    subCategory: { type: String, default: "" },
    fit: { type: String, default: "" },
    fabric: { type: String, default: "" },
    occasion: [{ type: String }],
    gender: { type: String, default: "unisex" },
    season: [{ type: String }],
    aiTags: [{ type: String }],
    isOnSale: { type: Boolean, default: false },
    isEssential: { type: Boolean, default: false },
    essentialCollection: { type: String, default: '' }, // e.g. "BAGGY SHIRT", "POLO T-SHIRT"
    originalPrice: { type: String },
    inStock: { type: Boolean, default: true },
    sku: { type: String, default: "" },
    inventory: {
      type: Map,
      of: Number,
      default: { S: 0, M: 0, L: 0, XL: 0, XXL: 0, '3XL': 0 }
    },
    stock: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    sizes: [{ type: String }],
    colors: [{ type: String }],
    variants: [{
      colorName: { type: String, required: true },
      variantName: { type: String },
      images: [{ type: String }],
      stock: { type: Number, default: 0 },
      sizes: [{ type: String }],
      sizeInventory: { type: Map, of: Number, default: {} }
    }],
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    ratingDistribution: {
      type: Map,
      of: Number,
      default: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
