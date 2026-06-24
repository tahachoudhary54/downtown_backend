const mongoose = require('mongoose');
require('dotenv').config({path: './.env'});
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Product = require('./models/Product');
  const products = await Product.find({'variants.0': {$exists: true}});
  products.forEach(p => {
    console.log(JSON.stringify({
      name: p.name,
      globalColors: p.colors,
      variants: p.variants.map(v => ({colorName: v.colorName, images: v.images}))
    }, null, 2));
  });
  process.exit();
});
