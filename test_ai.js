const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
require('dotenv').config();
const { cloneQuery, fetchProductsWithColorMatching } = require('./controllers/aiController');

test('Query cloning and MongoDB filter tests', async (t) => {
    // Ensure DB connection for real tests
    await mongoose.connect(process.env.MONGO_URI);

    await t.test('cloneQuery should preserve RegExp', () => {
        const baseQuery = { category: { $in: [/jeans/i] } };
        const clonedQuery = cloneQuery(baseQuery);
        
        // Assert it is deep cloned but still RegExp
        assert.notStrictEqual(clonedQuery, baseQuery);
        assert.ok(clonedQuery.category.$in[0] instanceof RegExp);
        assert.strictEqual(clonedQuery.category.$in[0].source, 'jeans');
        assert.strictEqual(clonedQuery.category.$in[0].flags, 'i');
    });

    await t.test('cloneQuery should preserve Date and ObjectId', () => {
        const oid = new mongoose.Types.ObjectId();
        const date = new Date();
        const baseQuery = { _id: oid, createdAt: date };
        const clonedQuery = cloneQuery(baseQuery);
        
        assert.strictEqual(clonedQuery._id.toString(), oid.toString());
        assert.strictEqual(clonedQuery.createdAt.getTime(), date.getTime());
    });

    await t.test('fetchProductsWithColorMatching - Color Search (Black)', async () => {
        const baseQuery = { inStock: true, $and: [] };
        const llmOutput = { exact_colors: ["Black"], similar_colors: ["Grey"] };
        console.log('TEST 3 START');
        const { products, fallbackUsed } = await fetchProductsWithColorMatching(baseQuery, llmOutput, 10);
        console.log('TEST 3 products.length:', products.length);
        console.log('TEST 3 fallbackUsed:', fallbackUsed);
        
        assert.ok(products.length > 0, "Should return black products");
        assert.strictEqual(fallbackUsed, false, "Should not use fallback");
    });

    await t.test('fetchProductsWithColorMatching - Combined Filters (Color + Category + Fit)', async () => {
        const baseQuery = { inStock: true, $and: [] };
        
        // Mocking the behavior where processChat pushes RegExps into baseQuery
        const fitRegex = [new RegExp('loose', 'i'), new RegExp('baggy', 'i')];
        baseQuery.$and.push({
            $or: [
                { fit: { $in: fitRegex } }, 
                { name: { $in: fitRegex } }, 
                { aiTags: { $in: fitRegex } }
            ]
        });

        const catRegex = [new RegExp('jean', 'i')];
        baseQuery.$and.push({
            $or: [
                { category: { $in: catRegex } }, 
                { subCategory: { $in: catRegex } }, 
                { name: { $in: catRegex } }
            ]
        });

        const llmOutput = { exact_colors: ["Black"], similar_colors: ["Grey"] };
        const { products, fallbackUsed } = await fetchProductsWithColorMatching(baseQuery, llmOutput, 10);
        
        assert.ok(products.length > 0, "Should return black baggy jeans");
        assert.strictEqual(fallbackUsed, false, "Should not use fallback for black baggy jeans");
        
        // Verify it actually found a baggy/loose black jean
        const hasMatch = products.some(p => p.name.toLowerCase().includes('baggy') || p.name.toLowerCase().includes('jean'));
        assert.ok(hasMatch, "Product name should include baggy or jean");
    });

    await t.test('fetchProductsWithColorMatching - No Results -> Similar Colors', async () => {
        const baseQuery = { inStock: true, $and: [] };
        // Ask for a nonexistent color "NeonPink", fallback to "Black"
        const llmOutput = { exact_colors: ["NeonPink999"], similar_colors: ["Black"] };
        const { products, fallbackUsed, requestedColors } = await fetchProductsWithColorMatching(baseQuery, llmOutput, 10);
        
        assert.ok(products.length > 0, "Should return similar black products");
        assert.strictEqual(fallbackUsed, true, "Should use similar_colors fallback");
        assert.strictEqual(requestedColors[0], "Black");
    });

    await mongoose.connection.close();
});
