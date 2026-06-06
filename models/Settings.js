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
    },
    store: {
      storeName: { type: String, default: "Downtown Boutique" },
      contactEmail: { type: String, default: "support@downtownboutique.com" },
      phoneNumber: { type: String, default: "+1 (555) 123-4567" },
      currency: { type: String, default: "USD" },
      flatShippingRate: { type: Number, default: 15.00 },
      socialLinks: {
        instagram: { type: String, default: "https://www.instagram.com/downtown_boutique_kurla/" },
        facebook: { type: String, default: "" },
        twitter: { type: String, default: "" }
      }
    },
    whatsapp: {
      enabled: { type: Boolean, default: false },
      adminNumber: { type: String, default: "" },
      sendCustomerConfirmation: { type: Boolean, default: false },
      sendStatusUpdates: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
