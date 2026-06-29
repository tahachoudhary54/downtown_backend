require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testGroq() {
    console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "Loaded" : "Missing");
    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: 'OUTPUT JSON with these exact keys:\n"intent": "chat", "response_text": "hello"' },
                { role: 'user', content: 'hi' }
            ],
            response_format: { type: 'json_object' }
        });
        console.log("Success:", response.choices[0].message.content);
    } catch (e) {
        console.error("Error calling Groq:", e.status, e.message);
    }
}
testGroq();
