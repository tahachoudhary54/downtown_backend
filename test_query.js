require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    const llmOutput = { exact_colors: ["Black"] };
    let finalQuery = { inStock: true, $and: [] };
    
    let requestedColors = llmOutput.exact_colors;
    const colorRegex = requestedColors.map(c => new RegExp(`\\\\b${c}\\\\b`, 'i'));
    
    finalQuery.$and.push({
        $or: [
            { colors: { $in: colorRegex } },
            { 'variants.colorName': { $in: colorRegex } },
            { name: { $in: colorRegex } }
        ]
    });
    
    console.log(JSON.stringify(finalQuery, null, 2));
    let products = await Product.find(finalQuery).limit(10).lean();
    console.log("Found products:", products.length);
    products.forEach(p => console.log(p.name, p.variants.map(v => v.colorName)));
    process.exit();
}
test();
