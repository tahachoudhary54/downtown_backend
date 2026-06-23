require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  await Product.updateOne({ name: 'Baggy Shirt' }, { $set: { category: 'Shirts' } });
  console.log('Updated Baggy Shirt category to Shirts');
  process.exit();
});
