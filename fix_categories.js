const mongoose = require("mongoose");
const Product = require("./models/Product");
require("dotenv").config();

async function fixProductCategories() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/downtown_db');
  console.log("Connected to MongoDB.");

  const products = await Product.find({});
  let updatedCount = 0;

  for (let p of products) {
    const catLower = p.category.toLowerCase();
    let newCategory = null;

    if (catLower.includes('jeans')) {
      newCategory = 'Jeans';
    } else if (catLower.includes('t-shirt') || catLower.includes('tshirt')) {
      newCategory = 'T-Shirts';
    } else if (catLower.includes('shirt')) {
      newCategory = 'Shirts';
    } else if (catLower.includes('pant')) {
      newCategory = 'Pants';
    }

    if (newCategory && p.category !== newCategory) {
      p.category = newCategory;
      await p.save();
      console.log(`Updated product ${p.name} category to ${newCategory}`);
      updatedCount++;
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} products.`);
  process.exit(0);
}

fixProductCategories();
