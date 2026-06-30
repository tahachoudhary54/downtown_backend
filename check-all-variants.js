require('dotenv').config();
require('mongoose').connect(process.env.MONGO_URI).then(async () => {
  const Product = require('./models/Product');
  const products = await Product.find({'variants.0': { $exists: true }});
  console.log(`Found ${products.length} products with variants.`);
  products.forEach(p => {
    console.log(`Product: ${p.name}`);
    p.variants.forEach(v => {
      console.log(`  Variant ${v.colorName}: stock = ${v.stock}`);
      console.log(`  Sizes Inventory: ${JSON.stringify(v.sizeInventory)}`);
    });
  });
  process.exit(0);
});
