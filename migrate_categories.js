const mongoose = require("mongoose");
const Category = require("./models/Category");
require("dotenv").config();

const defaultCategories = [
  { id: '1', categoryId: 'cat1', name: 'Shirts', slug: 'shirts', img: '/editorial_1.png', isActive: true, displayOrder: 1 },
  { id: '2', categoryId: 'cat2', name: 'Jeans', slug: 'jeans', img: '/editorial_2.png', isActive: true, displayOrder: 2 },
  { id: '3', categoryId: 'cat3', name: 'T-Shirts', slug: 't-shirts', img: '/editorial_3.png', isActive: true, displayOrder: 3 },
  { id: '4', categoryId: 'cat4', name: 'Pants', slug: 'pants', img: '/editorial_4.png', isActive: true, displayOrder: 4 }
];

async function migrateCategories() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/downtown_db');
  console.log("Connected to MongoDB.");

  for (let cat of defaultCategories) {
    const exists = await Category.findOne({ slug: cat.slug });
    if (!exists) {
      await Category.create({
        name: cat.name,
        slug: cat.slug,
        img: cat.img,
        isActive: cat.isActive,
        displayOrder: cat.displayOrder
      });
      console.log(`Created category: ${cat.name}`);
    } else {
      console.log(`Category exists: ${cat.name}`);
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

migrateCategories();
