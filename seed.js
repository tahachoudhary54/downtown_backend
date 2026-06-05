require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

const products = [
  {
    name: "Midnight Navy Polo",
    price: "₹2,499",
    priceValue: 2499,
    img: "/luxury_polo.png",
    category: "clothing",
    description: "Experience true luxury with the Midnight Navy Polo. Crafted from premium materials with meticulous attention to detail, this piece offers a perfect blend of sophisticated style and unparalleled comfort.",
    isOnSale: false,
    inStock: true,
  },
  {
    name: "Classic White Oxford",
    price: "₹3,299",
    priceValue: 3299,
    img: "/sleek_button_down.png",
    category: "clothing",
    description: "A staple for any wardrobe, this Classic White Oxford shirt brings an air of sophistication to your look, featuring crisp, clean lines and premium breathable fabric.",
    isOnSale: false,
    inStock: true,
  },
  {
    name: "Earth Tone Cashmere",
    price: "₹5,499",
    priceValue: 5499,
    img: "/elegant_sweater.png",
    category: "clothing",
    description: "Stay warm and effortlessly stylish in this Earth Tone Cashmere. Woven from the finest fibers, it provides unparalleled softness and a perfect, tailored fit.",
    isOnSale: false,
    inStock: true,
  },
  {
    name: "Premium Velvet Blazer",
    price: "₹8,999",
    priceValue: 8999,
    img: "/product_image.png",
    category: "clothing",
    description: "Make a bold statement with the Premium Velvet Blazer. Its rich texture and meticulous tailoring make it the ultimate choice for an elevated evening look.",
    isOnSale: true,
    originalPrice: "₹11,999",
    inStock: true,
  },
  {
    name: "Signature Velvet Jacket",
    price: "₹8,999",
    priceValue: 8999,
    img: "/product_image.png",
    category: "clothing",
    description: "Step out in unparalleled style with the Signature Velvet Jacket. Designed for those who appreciate the finer things, it combines classic elegance with modern flair.",
    isOnSale: true,
    originalPrice: "₹12,999",
    inStock: true,
  },
  {
    name: "Premium Navy Polo",
    price: "₹2,799",
    priceValue: 2799,
    img: "/luxury_polo.png",
    category: "clothing",
    description: "An everyday essential elevated to luxury status. The Premium Navy Polo offers exceptional comfort and a sleek silhouette perfect for any casual occasion.",
    isOnSale: false,
    inStock: true,
  },
  {
    name: "Autumn Cashmere Blend",
    price: "₹6,499",
    priceValue: 6499,
    img: "/elegant_sweater.png",
    category: "clothing",
    description: "Embrace the cooler months with our Autumn Cashmere Blend. Incredibly soft and rich in color, it's a testament to refined craftsmanship.",
    isOnSale: false,
    inStock: true,
  },
  {
    name: "Executive Oxford Shirt",
    price: "₹3,499",
    priceValue: 3499,
    img: "/sleek_button_down.png",
    category: "clothing",
    description: "Command attention in the boardroom with the Executive Oxford Shirt. Tailored for success, it features premium cotton for all-day comfort and sharpness.",
    isOnSale: false,
    inStock: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing products
    await Product.deleteMany({});
    console.log("🗑️  Cleared existing products");

    // Insert all products
    const inserted = await Product.insertMany(products);
    console.log(`✅ Seeded ${inserted.length} products successfully!`);

    inserted.forEach(p => console.log(`  → ${p.name} (${p._id})`));
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

seed();
