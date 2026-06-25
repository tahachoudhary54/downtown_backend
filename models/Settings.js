const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    hero: {
      slides: { 
        type: [String], 
        default: ["/hero_slide_1.jpg", "/hero_slide_2.jpg", "/hero_slide_3.jpg"] 
      },
      title: { type: String, default: "Everyday Style. Premium Comfort." },
      subtitle: { type: String, default: "Discover the new standard of modern luxury menswear. Designed for the discerning individual." },
      buttonText: { type: String, default: "Shop Collection" },
      buttonLink: { type: String, default: "/shop" }
    },
    seasonalBanner: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: "Autumn Collection –\nUp to 30% OFF" },
      image: { type: String, default: "/autumn_banner.png" },
      buttonText: { type: String, default: "SHOP COLLECTION" },
      buttonLink: { type: String, default: "/shop" }
    },
    categories: {
      type: [{
        id: String,
        categoryId: String,
        name: String,
        slug: String,
        img: String,
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 }
      }],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
