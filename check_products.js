const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const Product = require('./models/Product');
    const allProducts = await Product.find({});
    
    console.log('--- Product Database Summary ---');
    console.log(`Total Products: ${allProducts.length}`);
    
    const uniqueColors = new Set();
    const uniqueCategories = new Set();
    const uniqueBrands = new Set();

    let totalVariants = 0;

    allProducts.forEach(product => {
      // Gather dynamic colors
      if (product.colors && Array.isArray(product.colors)) {
        product.colors.forEach(c => uniqueColors.add(c.toLowerCase()));
      }
      
      // Gather variant colors
      if (product.variants && Array.isArray(product.variants)) {
        totalVariants += product.variants.length;
        product.variants.forEach(v => {
          if (v.colorName) uniqueColors.add(v.colorName.toLowerCase());
        });
      }

      // Gather categories
      if (product.category) uniqueCategories.add(product.category.toLowerCase());
      
      // Gather brands
      if (product.brand) uniqueBrands.add(product.brand);
    });

    console.log(`Total Variants: ${totalVariants}`);
    console.log(`\nUnique Categories (${uniqueCategories.size}):`, Array.from(uniqueCategories).join(', '));
    console.log(`Unique Brands (${uniqueBrands.size}):`, Array.from(uniqueBrands).join(', '));
    console.log(`Unique Colors Detected Across All Products (${uniqueColors.size}):`, Array.from(uniqueColors).join(', '));

    console.log('\n--- Dynamic Output Generated Successfully ---');
    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });
