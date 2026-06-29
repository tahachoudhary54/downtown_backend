require('dotenv').config();
require('mongoose').connect(process.env.MONGO_URI).then(async () => {
  const Product = require('./models/Product');
  const doc = await Product.findById('6a22e32d4e5f0629b74c13d9');
  console.log('Product exists:', !!doc);
  if (doc) console.log('Product Name:', doc.name);
  process.exit();
}).catch(console.error);
