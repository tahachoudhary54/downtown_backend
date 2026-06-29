const test = require('node:test');
const assert = require('node:assert');

const prompts = [
  "Black colour me kuch hai?",
  "Black baggy jeans dikhao",
  "White polo t-shirt",
  "Loose fit black jeans",
  "Black shirt under ₹2000"
];

test('End-to-End Chat Prompts Test', async (t) => {
  for (const prompt of prompts) {
    await t.test(`Prompt: "${prompt}"`, async () => {
      const response = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      assert.strictEqual(response.status, 200, 'API should return 200 OK');
      
      const data = await response.json();
      
      // Ensure there are matching products
      assert.ok(data.products && data.products.length > 0, 'Should return matching products');
      
      // Ensure fallback message is NOT shown (dbFallbackUsed should be false, so it shouldn't say "couldn't find an exact match")
      assert.ok(!data.message.includes("couldn't find an exact match in our current collection"), 'Should not use DB fallback message');
      
      console.log(`\n✅ Passed: "${prompt}"`);
      console.log(`   Products Found: ${data.products.length}`);
      console.log(`   Message: ${data.message}`);
      console.log(`   Top Match: ${data.products[0].name} (Colors: ${data.products[0].colors?.join(',') || 'N/A'}, Variants: ${data.products[0].variants?.map(v=>v.colorName).join(',') || 'N/A'})`);
      
      // Sleep for a few seconds to avoid hitting the 15 req/min Gemini rate limit
      await new Promise(resolve => setTimeout(resolve, 4500));
    });
  }
});
