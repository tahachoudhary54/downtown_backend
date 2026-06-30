const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const Product = require('./models/Product');
    const docs = await Product.find({});
    docs.forEach(d => {
      let weird = false;
      if (d.colors && d.colors.some(c => c.toLowerCase().includes('shirt') || c.toLowerCase().includes('jeans'))) weird = true;
      if (d.variants && d.variants.some(v => v.colorName && (v.colorName.toLowerCase().includes('shirt') || v.colorName.toLowerCase().includes('jeans')))) weird = true;
      if (weird) {
        console.log(`Product: ${d.name} (${d._id})`);
        console.log(`  Colors:`, d.colors);
        if (d.variants) console.log(`  Variants:`, d.variants.map(v => v.colorName));
      }
    });
    process.exit(0);
  });
