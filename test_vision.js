const fs = require('fs');
const path = require('path');

async function testVision() {
    try {
        // Find a random image in the frontend public folder to use as a test image
        const imgPath = 'c:/Users/admin/downtown/frontend/public/hero_bg.png';
        const imgBuffer = fs.readFileSync(imgPath);
        const base64 = imgBuffer.toString('base64');
        
        console.log('Testing /api/ai/vision-search with base64 size:', base64.length);
        
        const res = await fetch('http://localhost:5000/api/ai/vision-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mimeType: 'image/png' })
        });
        
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Attributes:', data.attributes);
        console.log('Products returned:', data.products?.length || 0);
        console.log('Message:', data.message);
    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testVision();
