const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    hero: {
      slides: { 
        type: [String], 
        default: ["/hero_bg.png", "/hero_bg_v4.png", "/hero_bg_v6.png"] 
      },
      title: { type: String, default: "ELEVATE YOUR\nEVERYDAY" },
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
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
