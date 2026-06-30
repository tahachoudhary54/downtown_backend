require('dotenv').config();
require('mongoose').connect(process.env.MONGO_URI).then(async () => {
  const Product = require('./models/Product');
  const products = await Product.find({'variants.stock': { $gt: 0, $lte: 5 }});
  console.log('Found:', products.length);
  products.forEach(p => {
    console.log(`Product: ${p.name}`);
    p.variants.forEach(v => {
      console.log(`  Variant ${v.colorName}: stock = ${v.stock}`);
    });
  });
  process.exit(0);
});
