const mongoose = require('mongoose');
require('dotenv').config();

const mapping = {
  'BAGGY SHIRT': 'SHIRT',
  'REGULAR SHIRT': 'SHIRT',
  'LINEN SHIRT': 'SHIRT',
  'HALF SLEEVE SHIRT': 'SHIRT',
  'POLO T-SHIRT': 'T-SHIRT',
  'FULL SLEEVE T-SHIRT': 'T-SHIRT',
  'BAGGY JEANS': 'JEANS',
  'BOOT CUT JEANS': 'JEANS',
  'REGULAR FIT JEANS': 'JEANS',
  'STRAIGHT FIT JEANS': 'JEANS',
  'TRACK PANT': 'TRACK PANT' // Maybe leave this one or map to a new 'PANTS'
};

const filterPageCategories = ['SHIRT', 'T-SHIRT', 'JEANS', 'TRACK PANT', 'PANTS'];

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Product = mongoose.model('Product', new mongoose.Schema({ category: String }, { strict: false }));
  const Category = mongoose.model('Category', new mongoose.Schema({ name: String }, { strict: false }));

  for (const [oldCat, newCat] of Object.entries(mapping)) {
    const res = await Product.updateMany({ category: oldCat }, { $set: { category: newCat } });
    console.log(`Updated ${res.modifiedCount} products from ${oldCat} to ${newCat}`);
    
    // Check if newCat exists in Category model, if not, create it
    const exists = await Category.findOne({ name: newCat });
    if (!exists) {
      await Category.create({ name: newCat, slug: newCat.toLowerCase().replace(/ /g, '-') });
      console.log(`Created new Category: ${newCat}`);
    }
  }

  // Now delete all categories that are NOT in filterPageCategories
  const allCats = await Category.find();
  for (const cat of allCats) {
    if (!filterPageCategories.includes(cat.name)) {
      await Category.findByIdAndDelete(cat._id);
      console.log(`Deleted category: ${cat.name}`);
    }
  }

  console.log("Migration complete.");
  mongoose.disconnect();
});
