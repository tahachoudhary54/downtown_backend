const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const Product = require('./models/Product');
    const docs = await Product.find({});
    
    let updatedCount = 0;

    for (const doc of docs) {
      let isModified = false;

      // Function to normalize color strings
      const normalizeColor = (colorStr) => {
        if (!colorStr) return colorStr;
        let normalized = colorStr.trim();
        // Remove product names from colors (e.g. "Baggy Shirt-Brown" -> "Brown")
        if (normalized.toLowerCase().includes('baggy shirt-')) {
          normalized = normalized.replace(/baggy shirt-/i, '').trim();
        }
        if (normalized.toLowerCase().includes(' jeans')) {
          normalized = normalized.replace(/ jeans/i, '').trim();
        }
        
        // Capitalize first letter
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
      };

      // Check and normalize root colors array
      if (doc.colors && Array.isArray(doc.colors)) {
        const newColors = doc.colors.map(c => normalizeColor(c));
        // Check if anything actually changed
        if (JSON.stringify(doc.colors) !== JSON.stringify(newColors)) {
          doc.colors = newColors;
          isModified = true;
        }
      }

      // Check and normalize variants
      if (doc.variants && Array.isArray(doc.variants)) {
        doc.variants.forEach(variant => {
          if (variant.colorName) {
            const newColorName = normalizeColor(variant.colorName);
            if (variant.colorName !== newColorName) {
              variant.colorName = newColorName;
              isModified = true;
            }
          }
        });
      }

      // Save if modified
      if (isModified) {
        // We use markModified because variants might be mixed type or subdocument
        doc.markModified('colors');
        doc.markModified('variants');
        await doc.save();
        updatedCount++;
        console.log(`Updated product: ${doc.name} (${doc._id})`);
      }
    }

    console.log(`Migration completed successfully. ${updatedCount} products updated.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });
