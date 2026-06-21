const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/downtown_db').then(async () => {
  const products = await Product.find({});
  console.log(`Total Products: ${products.length}`);
  const visible = products.filter(p => p.inStock);
  const hidden = products.filter(p => !p.inStock);
  console.log(`Visible: ${visible.length}, Hidden: ${hidden.length}`);
  console.log("Visible products:");
  visible.forEach(p => console.log(`- ${p.name}`));
  mongoose.connection.close();
}).catch(console.error);
