require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('./models/Settings');

async function update() {
  await mongoose.connect(process.env.MONGO_URI);
  
  let doc = await Settings.findOne();
  if (doc) {
    doc.seasonalBanner.buttonText = "SHOP SALE";
    doc.seasonalBanner.buttonLink = "/sale";
    await doc.save();
    console.log("Updated remote DB successfully!");
  } else {
    console.log("No settings document found in remote DB.");
  }
  
  mongoose.disconnect();
}

update();
