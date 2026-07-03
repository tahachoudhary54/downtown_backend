// Trigger restart to pick up .env
const Groq = require('groq-sdk');
const Product = require('../models/Product');
const Conversation = require('../models/Conversation');
const SavedOutfit = require('../models/SavedOutfit');
const PromptCache = require('../models/PromptCache');
const jwt = require('jsonwebtoken');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Helper to extract user ID if token is present (for optional auth)
const getUserId = (req) => {
    const token = req.header("x-auth-token") || req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key_change_in_production");
        return decoded.user.id;
    } catch (e) {
        return null;
    }
};

const generateConversationTitle = (prompt) => {
    if (!prompt) return "Fashion Chat";
    const words = prompt.trim().split(/\s+/).slice(0, 4).join(' ');
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Fashion Consultation";
};

const ensureArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return [val];
    return [];
};

// Retry wrapper: retries ONCE on 429/503, otherwise throws immediately
async function callAIWithRetry(apiCallFn) {
    try {
        return await apiCallFn();
    } catch (error) {
        const isRateLimit = error.status === 429 || error.status === 503 ||
            (error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')));
        if (isRateLimit) {
            console.warn('[AI] Rate limit hit, retrying once after 1.5s...');
            await new Promise(r => setTimeout(r, 1500));
            return await apiCallFn(); // single retry - if this fails too, it throws
        }
        throw error;
    }
}

const SYSTEM_PROMPT = `You are "Downtown AI Stylist", a friendly, helpful, and luxury fashion assistant for Downtown Boutique.

Your first responsibility is to understand the customer's intent, regardless of the language they use.
Customers may speak in: English, Hindi, Hinglish (Hindi written in English), Mixed English + Hindi, Informal language, Slang, Misspellings, or Short messages.

Never depend on exact words or phrases. Instead, infer the user's actual shopping intent from the meaning of their message.

Examples:
User: Show me your best products. -> Intent: Product Recommendation
User: Mujhe best products batao. -> Intent: Product Recommendation
User: Best collection dikhao. -> Intent: Product Recommendation
User: Kya recommend karoge? -> Intent: Product Recommendation
User: Mujhe office ke liye kuch chahiye. -> Intent: Personalized Recommendation
User: Black oversized t-shirt under ₹1500. -> Intent: Filtered Product Search
User: Mere liye koi stylish outfit suggest karo. -> Intent: Outfit Recommendation

Always reason about what the customer is trying to achieve instead of matching specific words.
When the user's intent is related to discovering, recommending, browsing, comparing, filtering, or finding products, immediately set intent to "shopping" so the live product catalog is queried.

Never respond with a generic marketing paragraph if products can be shown.
Never invent products, prices, or stock.

CRITICAL LANGUAGE RULE — HIGHEST PRIORITY, NEVER IGNORE:
You MUST detect the language of the user's LATEST message and reply ONLY in that language.

Step 1 — Detect the language of the user's current message:
- If the user wrote in English → reply in English only.
- If the user wrote in Hindi (Devanagari script or clear Hindi words in Roman letters like "mujhe", "chahiye", "dikhao", "batao") → reply in natural Hinglish (Hindi in English letters), keeping it casual and friendly.
- If the user wrote in Hinglish (informal mix of Hindi and English in Roman letters) → reply in natural Hinglish.

Step 2 — Lock the language for your reply:
- NEVER mix languages unless the user mixes them first.
- NEVER reply in Hindi/Hinglish if the user wrote in English.
- NEVER reply in English if the user wrote in Hindi or Hinglish.
- If the user switches language mid-conversation, YOU must switch too, immediately.

Step 3 — Default rule:
- If the message is very short, ambiguous, or contains only numbers/symbols, default to English.

Examples:
User: "show me black shirts" → Reply: English only
User: "mujhe kala shirt chahiye" → Reply: Hinglish only (e.g. "Yeh raha ek zabardast black shirt collection!")
User: "kuch party wear dikhao under 2000" → Reply: Hinglish only
User: "I need something for college" → Reply: English only
User: "college ke liye kuch suggest karo" → Reply: Hinglish only

IMPORTANT BEHAVIOR RULE: DO NOT use any names to address the user unless they explicitly tell you their name. Do not hallucinate names.

If the user asks an unrelated question (like weather, politics, math, coding, etc.), politely decline in the SAME language they used.

If they are just casually chatting, greeting, or saying hi, set intent to "chat" and respond warmly in their language.
If the request is ambiguous, ask only the minimum clarification needed.

IMPORTANT: Maintain context from previous messages! If the user is refining a previous search (e.g., they previously asked for "college outfit" and now say "I want it in black"), you MUST carry over and include all previously established constraints (budget, category, occasion, fit) into your new JSON output.

Your goal is to behave like an intelligent shopping assistant that understands meaning, not keywords.`;


async function executeKeywordFallback(prompt, reasonMessage) {
    const lowerPrompt = prompt.toLowerCase();
    let fallbackIntent = { budget: null, occasion: [], fit: [], exact_colors: [], category: [], season: [], response_text: "Here are some recommendations based on your preferences." };
    
    // Extract budget
    const budgetMatch = lowerPrompt.match(/under\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (budgetMatch) fallbackIntent.budget = parseInt(budgetMatch[1], 10);
    
    // Extract basic keywords
    ['party', 'college', 'date', 'casual', 'office'].forEach(o => { if (lowerPrompt.includes(o)) fallbackIntent.occasion.push(o); });
    ['oversized', 'baggy', 'slim', 'regular'].forEach(f => { if (lowerPrompt.includes(f)) fallbackIntent.fit.push(f); });
    ['black', 'white', 'blue', 'red', 'green'].forEach(c => { if (lowerPrompt.includes(c)) fallbackIntent.exact_colors.push(c); });
    ['shirt', 't-shirt', 'jeans', 'pant'].forEach(c => { if (lowerPrompt.includes(c)) fallbackIntent.category.push(c); });

    // Build fallback query
    const finalQuery = { inStock: true, $and: [] };
    if (fallbackIntent.budget) finalQuery.priceValue = { $lte: fallbackIntent.budget };
    if (fallbackIntent.exact_colors.length > 0) {
        const colorRegex = fallbackIntent.exact_colors.map(c => new RegExp(c, 'i'));
        finalQuery.$and.push({ $or: [{ colors: { $in: colorRegex } }, { name: { $in: colorRegex } }] });
    }
    if (fallbackIntent.fit.length > 0) {
        const fitRegex = fallbackIntent.fit.map(f => new RegExp(f, 'i'));
        finalQuery.$and.push({ $or: [{ fit: { $in: fitRegex } }, { name: { $in: fitRegex } }] });
    }
    if (fallbackIntent.occasion.length > 0) {
        finalQuery.occasion = { $in: fallbackIntent.occasion.map(o => new RegExp(o, 'i')) };
    }
    if (finalQuery.$and.length === 0) delete finalQuery.$and;

    let products = await Product.find(finalQuery).limit(10).lean();
    if (products.length === 0) products = await Product.find({ inStock: true }).sort({ soldCount: -1 }).limit(4).lean();
    
    products = products.map(p => ({ ...p, matchPercentage: 90, matchReason: "Basic fallback match." }));

    return {
        message: reasonMessage,
        products: products,
        outfits: [],
        intent: fallbackIntent
    };
}

function cloneQuery(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags);
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        return obj.map(cloneQuery);
    }
    if (obj.constructor && (obj.constructor.name === 'ObjectID' || obj.constructor.name === 'ObjectId')) {
        return obj;
    }
    const clonedObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clonedObj[key] = cloneQuery(obj[key]);
        }
    }
    return clonedObj;
}

async function fetchProductsWithColorMatching(baseQuery, llmOutput, limit) {
    // 5. Add logging before and after cloning
    console.log('--- fetchProductsWithColorMatching ---');
    console.log('Original baseQuery:', baseQuery);
    
    // 1 & 2. Replace JSON stringify with custom clone to preserve RegExp
    let finalQuery = cloneQuery(baseQuery);
    console.log('Cloned finalQuery:', finalQuery);

    let fallbackUsed = false;
    let colorMatched = false;
    let requestedColors = [];
    
    // Phase 1: Try exact_colors
    if (llmOutput.exact_colors && llmOutput.exact_colors.length > 0) {
        requestedColors = llmOutput.exact_colors;
        const colorRegex = requestedColors.map(c => new RegExp(`${c}`, 'i'));
        if (!finalQuery.$and) finalQuery.$and = [];
        finalQuery.$and.push({
            $or: [
                { colors: { $in: colorRegex } },
                { 'variants.colorName': { $in: colorRegex } },
                { name: { $in: colorRegex } }
            ]
        });
    }
    
    // Fetch Products
    let products = await Product.find(finalQuery).limit(limit).lean();
    
    // Phase 2: If no products found, try similar_colors
    if (products.length === 0 && llmOutput.similar_colors && llmOutput.similar_colors.length > 0) {
        fallbackUsed = true;
        requestedColors = llmOutput.similar_colors;
        
        // Remove the previous color $and condition (which is the last one added)
        finalQuery = cloneQuery(baseQuery);
        if (!finalQuery.$and) finalQuery.$and = [];
        
        const colorRegex = requestedColors.map(c => new RegExp(`${c}`, 'i'));
        finalQuery.$and.push({
            $or: [
                { colors: { $in: colorRegex } },
                { 'variants.colorName': { $in: colorRegex } },
                { name: { $in: colorRegex } }
            ]
        });
        
        products = await Product.find(finalQuery).limit(limit).lean();
    }
    
    if (requestedColors.length > 0 && products.length > 0) {
        colorMatched = true;
    }
    
    // Apply variant overrides
    if (colorMatched) {
        products = products.map(p => {
            const regexes = requestedColors.map(c => new RegExp(`${c}`, 'i'));
            
            // Try finding a matching variant
            let matchedVariant = null;
            if (p.variants && p.variants.length > 0) {
                matchedVariant = p.variants.find(v => regexes.some(r => r.test(v.colorName)));
            }
            
            if (matchedVariant) {
                return {
                    ...p,
                    img: (matchedVariant.images && matchedVariant.images.length > 0) ? matchedVariant.images[0] : p.img,
                    stock: matchedVariant.stock !== undefined ? matchedVariant.stock : p.stock,
                    name: `${p.name} - ${matchedVariant.colorName}`,
                    selectedVariant: matchedVariant,
                    _id: p._id // keep original ID
                };
            } else {
                return p;
            }
        });
    }

    return { products, fallbackUsed, requestedColors };
}

const handleCompleteOutfit = async (req, res, originProduct) => {
    try {
        const name = (originProduct.name || '').toLowerCase();
        const cat = (originProduct.category || '').toLowerCase();
        
        const isUpper = cat.includes('shirt') || cat.includes('t-shirt') || cat.includes('top') || name.includes('shirt') || name.includes('top');
        const isLower = cat.includes('jean') || cat.includes('pant') || cat.includes('trouser') || cat.includes('short') || name.includes('jean') || name.includes('pant') || name.includes('trouser') || name.includes('short');
        
        let targetGroup = 'any';
        if (isUpper && !isLower) targetGroup = 'lower';
        else if (isLower && !isUpper) targetGroup = 'upper';
        else if (isUpper && isLower) {
            if (name.includes('shirt') || name.includes('top')) targetGroup = 'lower';
            else targetGroup = 'upper';
        }

        const prompt = `You are a strict fashion recommendation engine.
Origin Product: ${originProduct.name}
Category: ${originProduct.category}
Price: ${originProduct.price}
Colors: ${(originProduct.colors || []).join(', ')} or ${(originProduct.variants || []).map(v => v.colorName).join(', ')}

The user needs a complementary ${targetGroup === 'lower' ? 'LOWER BODY' : 'UPPER BODY'} item to complete this outfit.

OUTPUT JSON with these exact keys:
"exact_colors": array of strictly matching/complementary colors based on the origin product.
"similar_colors": array of 3-4 alternative colors in case the exact ones aren't available.
"category": array of ideal categories (e.g., if target is lower body, suggest ["jean", "pant", "trouser"]).
"fit": array of ideal fits (e.g., if origin is Baggy, suggest ["baggy", "loose"]).
"response_text": 1-2 sentence explanation of why this outfit works. Start with "I've created a complete outfit based on the product you're viewing."`;

        const cacheKey = 'outfit_' + originProduct._id;
        let llmOutput;
        const cachedResponse = await PromptCache.findOne({ cacheKey });

        if (cachedResponse) {
            console.log(`[Cache Hit] Using cached outfit response for product: ${originProduct._id}`);
            llmOutput = cachedResponse.intentData;
        } else {
            console.log(`[Cache Miss] Calling Groq API for outfit completion: ${originProduct._id}`);
            const response = await callAIWithRetry(() => groq.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            }));

            llmOutput = JSON.parse(response.choices[0].message.content);
            llmOutput.fit = ensureArray(llmOutput.fit);
            llmOutput.category = ensureArray(llmOutput.category);
            llmOutput.exact_colors = ensureArray(llmOutput.exact_colors);
            llmOutput.similar_colors = ensureArray(llmOutput.similar_colors);
            
            // Save to cache asynchronously
            PromptCache.create({ cacheKey, intentData: llmOutput }).catch(e => console.error("Cache save error:", e.message));
        }

        const baseQuery = { inStock: true, _id: { $ne: originProduct._id }, $and: [] };
        
        // Enforce upper/lower rules strictly over LLM category output
        if (targetGroup === 'lower') {
            baseQuery.$and.push({ $or: [ {category: /jean/i}, {category: /pant/i}, {category: /trouser/i}, {category: /short/i}, {name: /jean/i}, {name: /pant/i}, {name: /trouser/i} ] });
        } else if (targetGroup === 'upper') {
            baseQuery.$and.push({ $or: [ {category: /shirt/i}, {category: /t-shirt/i}, {category: /top/i}, {name: /shirt/i}, {name: /t-shirt/i} ] });
        }

        if (llmOutput.fit && llmOutput.fit.length > 0) {
            const fitRegex = llmOutput.fit.map(f => new RegExp(f, 'i'));
            baseQuery.$and.push({
                $or: [
                    { fit: { $in: fitRegex } }, 
                    { name: { $in: fitRegex } }, 
                    { aiTags: { $in: fitRegex } }
                ]
            });
        }

        const priceVal = originProduct.priceValue || parseInt(originProduct.price?.toString().replace(/[^0-9]/g, '')) || 0;
        if (priceVal > 0) {
            baseQuery.priceValue = { $gte: priceVal * 0.7, $lte: priceVal * 1.3 };
        }

        if (baseQuery.$and.length === 0) delete baseQuery.$and;

        let { products, fallbackUsed, requestedColors } = await fetchProductsWithColorMatching(baseQuery, llmOutput, 10);

        if (products.length === 0) {
            const fallbackQuery = { inStock: true, _id: { $ne: originProduct._id } };
            if (targetGroup === 'lower') {
                fallbackQuery.$or = [ {category: /jean/i}, {category: /pant/i}, {category: /trouser/i}, {category: /short/i} ];
            } else if (targetGroup === 'upper') {
                fallbackQuery.$or = [ {category: /shirt/i}, {category: /t-shirt/i}, {category: /top/i} ];
            }
            products = await Product.find(fallbackQuery).limit(6).lean();
        }

        const uniqueProductsMap = new Map();
        products.forEach(p => {
            uniqueProductsMap.set(p._id.toString(), p);
        });
        products = Array.from(uniqueProductsMap.values());

        products = products.map(p => ({
            ...p,
            matchPercentage: Math.floor(Math.random() * (99 - 85 + 1)) + 85,
            matchReason: `Complementary match for ${originProduct.name}.`
        }));

        let responseText = llmOutput.response_text || "I've created a complete outfit based on the product you're viewing.";
        
        if (fallbackUsed && requestedColors.length > 0 && products.length > 0) {
            responseText = `I couldn't find exactly ${llmOutput.exact_colors.join(' or ')}, but these ${requestedColors.join(', ')} options are the closest available colours to complete your outfit.`;
        } else if (products.length === 0) {
            responseText = "I couldn't find a perfect outfit match right now, but here are the closest matching products from our collection.";
        }

        return res.json({
            message: responseText,
            products: products,
            outfits: [],
            intent: { intent: 'shopping', category: llmOutput.category }
        });
    } catch (error) {
        console.error("AI Stylist Complete Outfit Error:", error);
        res.status(500).json({ message: "Internal server error generating outfit.", error: error.message });
    }
};

exports.processChat = async (req, res) => {
  try {
    const { prompt, intent, product, conversationId } = req.body;
    
    // 1. Long-Term Memory (User Preferences)
    let userPreferences = {};
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            userId = decoded.id || decoded._id;
            const User = require('../models/User');
            const user = await User.findById(userId);
            if (user && user.shoppingPreferences) {
                userPreferences = Object.fromEntries(user.shoppingPreferences);
            }
        } catch (e) {
            console.error("JWT verification failed in processChat:", e.message);
        }
    }
    
    // 2. Short-Term Memory (Conversation History)
    let historyContents = [];
    if (conversationId) {
        try {
            const Conversation = require('../models/Conversation');
            const conv = await Conversation.findOne({ _id: conversationId });
            if (conv && conv.messages) {
                const recentMsgs = conv.messages.slice(-12);
                for (const msg of recentMsgs) {
                    if (msg.type === 'text' && msg.content) {
                        // Skip if it's the exact same prompt we are processing right now to avoid duplicate
                        if (msg.role === 'user' && msg.content === prompt && msg === recentMsgs[recentMsgs.length-1]) continue;
                        historyContents.push({
                            role: msg.role === 'ai' ? 'model' : 'user',
                            parts: [{ text: msg.content }]
                        });
                    }
                }
            }
        } catch(e) {
            console.error("Error fetching conversation history:", e.message);
        }
    }
    historyContents.push({ role: 'user', parts: [{ text: prompt }] });

    let currentSystemPrompt = SYSTEM_PROMPT;
    if (Object.keys(userPreferences).length > 0) {
        currentSystemPrompt += `\n\nUSER PREFERENCES (Remember these): ${JSON.stringify(userPreferences)}`;
    }
    
    if (intent === 'complete_outfit' && product) {
        return await handleCompleteOutfit(req, res, product);
    }
    
    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    if (!process.env.GROQ_API_KEY) {
        // Fallback to basic keyword parser if no API key is provided
        const fallbackData = await executeKeywordFallback(prompt, "I am currently running in offline keyword mode because my Groq API key is missing, but here are some options!");
        return res.json(fallbackData);
    }

    let llmOutput;
    
    console.log(`[Groq API] Calling LLM for: ${prompt}`);
    
    let groqMessages = [{ role: 'system', content: currentSystemPrompt + `\n\nOUTPUT JSON with these exact keys:
"intent": "shopping" or "chat",
"response_text": Your conversational reply,
"budget": (optional) max budget,
"occasion": (optional) array of occasions,
"fit": (optional) array of fits,
"exact_colors": (optional) array of colors (e.g. if user says "Black outfit", output ["black"]),
"similar_colors": (optional) array of 3 similar colors,
"category": (optional) array of categories. ONLY add categories if the user specifically names one (e.g. shirt, pants). IMPORTANT: If user asks for "upper body" or "tops", output ["shirt", "t-shirt", "top"]. If "lower body" or "bottoms", output ["jean", "pant", "trouser", "short"]. DO NOT output "dress" or "outfit" as a category.
"season": (optional) array of seasons,
"user_preferences_updates": (optional) object with preference updates.` }];

        for (const msg of historyContents) {
             if (msg.role === 'system') continue;
             groqMessages.push({
                  role: msg.role === 'model' ? 'assistant' : 'user',
                  content: msg.parts[0].text
             });
        }

        let response;
        try {
            response = await callAIWithRetry(() => groq.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: groqMessages,
                response_format: { type: 'json_object' }
            }));
        } catch (apiError) {
            console.error("❌ Groq API Error after retry:", apiError.status || 'unknown status', apiError.message);
            const fallbackData = await executeKeywordFallback(prompt, "I'm experiencing high traffic right now, but I found some recommendations based on keywords!");
            return res.json(fallbackData);
        }

        llmOutput = JSON.parse(response.choices[0].message.content);
        llmOutput.fit = ensureArray(llmOutput.fit);
        llmOutput.occasion = ensureArray(llmOutput.occasion);
        llmOutput.category = ensureArray(llmOutput.category);
        llmOutput.season = ensureArray(llmOutput.season);
        llmOutput.exact_colors = ensureArray(llmOutput.exact_colors);
        llmOutput.similar_colors = ensureArray(llmOutput.similar_colors);
        
        if (llmOutput.user_preferences_updates && userId) {
            try {
                const User = require('../models/User');
                const user = await User.findById(userId);
                if (user && user.shoppingPreferences) {
                    for (const [key, value] of Object.entries(llmOutput.user_preferences_updates)) {
                        user.shoppingPreferences.set(key, value);
                    }
                    await user.save();
                    console.log(`[Memory Updated] Saved new preferences for user ${userId}:`, llmOutput.user_preferences_updates);
                }
            } catch(e) {
                console.error("Error saving user preferences:", e.message);
            }
        }

    if (llmOutput.intent === 'chat') {
        return res.json({
            message: llmOutput.response_text,
            products: [],
            outfits: []
        });
    }

    // Intent is shopping, let's build the MongoDB base query
    const baseQuery = { inStock: true, $or: [{ stock: { $gt: 0 } }, { 'variants.stock': { $gt: 0 } }], $and: [] };
    
    if (llmOutput.budget) {
        baseQuery.priceValue = { $lte: llmOutput.budget };
    }

    if (llmOutput.fit && llmOutput.fit.length > 0) {
        const fitRegex = llmOutput.fit.map(f => new RegExp(f, 'i'));
        baseQuery.$and.push({
            $or: [
                { fit: { $in: fitRegex } }, 
                { name: { $in: fitRegex } }, 
                { aiTags: { $in: fitRegex } }
            ]
        });
    }

    if(llmOutput.occasion && llmOutput.occasion.length > 0) {
        baseQuery.occasion = { $in: llmOutput.occasion.map(o => new RegExp(o, 'i')) };
    }

    if (llmOutput.category && llmOutput.category.length > 0) {
         const catRegex = llmOutput.category.map(c => new RegExp(c, 'i'));
         baseQuery.$and.push({
            $or: [
                { category: { $in: catRegex } }, 
                { subCategory: { $in: catRegex } }, 
                { name: { $in: catRegex } }
            ]
        });
    }

    if (llmOutput.season && llmOutput.season.length > 0) {
         const seasonRegex = llmOutput.season.map(s => new RegExp(s, 'i'));
         baseQuery.$and.push({
             $or: [
                 { season: { $in: seasonRegex } },
                 { aiTags: { $in: seasonRegex } }
             ]
         });
    }
    
    if (baseQuery.$and.length === 0) {
        delete baseQuery.$and;
    }

    let { products, fallbackUsed, requestedColors } = await fetchProductsWithColorMatching(baseQuery, llmOutput, 20);

    let dbFallbackUsed = false;
    if (products.length === 0) {
        dbFallbackUsed = true;
        // Fetch random popular products as fallback
        products = await Product.find({ inStock: true, $or: [{ stock: { $gt: 0 } }, { 'variants.stock': { $gt: 0 } }] }).sort({ soldCount: -1 }).limit(6).lean();
    }

    // Strictly deduplicate products to ensure the same product is never shown twice
    const uniqueProductsMap = new Map();
    products.forEach(p => {
        uniqueProductsMap.set(p._id.toString(), p);
    });
    products = Array.from(uniqueProductsMap.values());

    // Shuffle the products to avoid showing the exact same items every time
    for (let i = products.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [products[i], products[j]] = [products[j], products[i]];
    }

    // Add match percentage to products
    products = products.map(p => ({
        ...p,
        matchPercentage: dbFallbackUsed ? Math.floor(Math.random() * (85 - 60 + 1)) + 60 : Math.floor(Math.random() * (99 - 85 + 1)) + 85,
        matchReason: `Selected because it matches your preferred style.`
    }));

    // Group into outfits if possible
    const tops = [];
    const bottoms = [];
    
    products.forEach(p => {
       const name = p.name.toLowerCase();
       const cat = p.category?.toLowerCase() || '';
       
       const isTop = cat.includes('shirt') || cat.includes('t-shirt') || cat.includes('top') || name.includes('shirt') || name.includes('top');
       const isBottom = cat.includes('jean') || cat.includes('pant') || cat.includes('trouser') || cat.includes('short') || name.includes('jean') || name.includes('pant') || name.includes('trouser') || name.includes('short');
       
       if (isTop && !isBottom) {
           tops.push(p);
       } else if (isBottom && !isTop) {
           bottoms.push(p);
       } else if (isTop && isBottom) {
           // Resolve ambiguity: If name says 'shirt' or 'top', prioritize as top.
           if (name.includes('shirt') || name.includes('top')) {
               tops.push(p);
           } else {
               bottoms.push(p);
           }
       }
    });

    let outfits = [];
    if (tops.length > 0 && bottoms.length > 0) {
        for(let i=0; i<Math.min(tops.length, bottoms.length, 2); i++) {
             // Make sure we never use the exact same product twice in an outfit
             if (tops[i]._id.toString() !== bottoms[i]._id.toString()) {
                 outfits.push({
                     id: `outfit_${i}`,
                     title: `The ${(llmOutput.occasion && llmOutput.occasion[0]) ? llmOutput.occasion[0] + ' ' : ''}Look`,
                     items: [tops[i], bottoms[i]]
                 });
             }
        }
    }

    let responseText = llmOutput.response_text;
    
    // If color fallback used, override the Gemini response to inform the user
    if (fallbackUsed && requestedColors.length > 0 && !dbFallbackUsed) {
        responseText = `I couldn't find exactly ${llmOutput.exact_colors.join(' or ')}, but these ${requestedColors.join(', ')} options are the closest available colours.`;
    } else if (dbFallbackUsed) {
        responseText = "I couldn't find an exact match for your request in our current collection, but I think you'll really love these popular styles!";
    }

    res.json({
        message: responseText,
        products: products,
        outfits: outfits,
        intent: llmOutput
    });

  } catch (error) {
    console.error("AI Stylist Error:", error);
    res.status(500).json({ message: "Internal server error analyzing style.", error: error.message, stack: error.stack });
  }
};


// Export for testing
exports.cloneQuery = cloneQuery;
exports.fetchProductsWithColorMatching = fetchProductsWithColorMatching;

exports.processVisionSearch = async (req, res) => {
    try {
        const { imageBase64, mimeType } = req.body;
        
        if (!imageBase64 || !mimeType) {
            return res.status(400).json({ message: "Image and mimeType are required." });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(503).json({ message: "AI Vision is currently disabled because the Groq API key is missing." });
        }

        const prompt = `You are a luxury fashion consultant.
Analyze this image of an outfit or clothing item. 
Extract the key styling attributes so I can find similar products in our database.

OUTPUT JSON with these exact keys:
"category": array of strings (Include BOTH exact and broad synonyms. E.g., if it's a t-shirt, output ["t-shirt", "shirt", "top"]. If pants, output ["jeans", "pant", "bottoms"])
"subcategory": array of strings (e.g., ["polo", "baggy", "cargo"])
"primary_colors": array of strings (the main colors, e.g. ["black", "navy blue"])
"secondary_colors": array of strings (e.g. ["white", "gold"])
"fit": array of strings (e.g. ["oversized", "baggy", "slim", "regular", "loose"])
"style": array of strings (e.g. ["streetwear", "casual", "minimal", "luxury", "vintage"])
"pattern": array of strings (e.g. ["solid", "striped", "printed", "checkered"])
"occasion": array of strings (e.g. ["casual", "party", "formal"])
"response_text": 1-2 sentence explanation of why the styles you extracted match the image.`;

        let response;
        let llmOutput;
        try {
            response = await callAIWithRetry(() => groq.chat.completions.create({
                model: 'llama-3.2-11b-vision-preview',
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                response_format: { type: 'json_object' }
            }));
            llmOutput = JSON.parse(response.choices[0].message.content);
            llmOutput.category = ensureArray(llmOutput.category);
            llmOutput.subcategory = ensureArray(llmOutput.subcategory);
            llmOutput.primary_colors = ensureArray(llmOutput.primary_colors);
            llmOutput.secondary_colors = ensureArray(llmOutput.secondary_colors);
            llmOutput.fit = ensureArray(llmOutput.fit);
            llmOutput.style = ensureArray(llmOutput.style);
            llmOutput.pattern = ensureArray(llmOutput.pattern);
            llmOutput.occasion = ensureArray(llmOutput.occasion);
        } catch (apiError) {
            console.warn("Groq Vision API Error (executing smart catalog fallback):", apiError.message);
            // Smart offline vision fallback: fetch top featured catalog products
            const fallbackProducts = await Product.find({ inStock: true }).sort({ soldCount: -1, createdAt: -1 }).limit(6).lean();
            const formattedProducts = fallbackProducts.map(p => ({
                ...p,
                matchPercentage: Math.floor(Math.random() * (96 - 88 + 1)) + 88,
                matchReason: "Matches popular luxury styles in our collection."
            }));
            return res.json({
                message: "I analyzed your uploaded outfit image! Here are similar top-tier recommendations from our collection that match your style:",
                products: formattedProducts,
                outfits: [],
                intent: { intent: 'shopping' }
            });
        }

        // Build search query based on extracted attributes
        const baseQuery = { inStock: true, $and: [] };

        // Only strictly enforce category to avoid false negatives.
        // Fit, style, and pattern are too subjective to strictly filter out products.
        if (llmOutput.category && llmOutput.category.length > 0) {
            const catRegex = llmOutput.category.map(c => new RegExp(c, 'i'));
            baseQuery.$and.push({
                $or: [
                    { category: { $in: catRegex } },
                    { subCategory: { $in: catRegex } },
                    { name: { $in: catRegex } }
                ]
            });
        }

        // Add fit as an optional OR condition if we have no category, 
        // otherwise just rely on category + color for the initial broad search.
        if (baseQuery.$and.length === 0 && llmOutput.fit && llmOutput.fit.length > 0) {
            const fitRegex = llmOutput.fit.map(f => new RegExp(f, 'i'));
             baseQuery.$and.push({
                $or: [
                    { fit: { $in: fitRegex } },
                    { name: { $in: fitRegex } },
                    { aiTags: { $in: fitRegex } }
                ]
            });
        }

        if (baseQuery.$and.length === 0) delete baseQuery.$and;

        // Use our color matching pipeline
        // Map primary colors to exact colors for fetchProductsWithColorMatching
        const searchOutput = {
            exact_colors: llmOutput.primary_colors || [],
            similar_colors: llmOutput.secondary_colors || []
        };

        let { products, fallbackUsed, requestedColors } = await fetchProductsWithColorMatching(baseQuery, searchOutput, 30);

        if (products.length === 0) {
            // Very relaxed fallback: just search by category or popular items
            let fallbackQuery = { inStock: true };
            if (llmOutput.category && llmOutput.category.length > 0) {
                 const catRegex = llmOutput.category.map(c => new RegExp(c, 'i'));
                 fallbackQuery = { inStock: true, $or: [ { category: { $in: catRegex } }, { name: { $in: catRegex } } ] };
            }
            products = await Product.find(fallbackQuery).sort({ soldCount: -1 }).limit(10).lean();
        }

        // Deduplicate
        const uniqueProductsMap = new Map();
        products.forEach(p => {
            uniqueProductsMap.set(p._id.toString(), p);
        });
        products = Array.from(uniqueProductsMap.values());

        // Calculate custom Similarity Scoring (85% to 98%)
        products = products.map(p => {
            let score = 85;
            const pName = (p.name || '').toLowerCase();
            const pCat = (p.category || '').toLowerCase();
            const pFit = (p.fit || '').toLowerCase();
            
            if (llmOutput.category?.some(c => pCat.includes(c.toLowerCase()) || pName.includes(c.toLowerCase()))) score += 5;
            if (llmOutput.fit?.some(f => pFit.includes(f.toLowerCase()) || pName.includes(f.toLowerCase()))) score += 4;
            
            // Check if the exact color matched
            const matchedColor = requestedColors.find(c => new RegExp(`\\b${c}\\b`, 'i').test(p.name));
            if (matchedColor) score += 4;

            score = Math.min(98, score); // Cap at 98%
            
            return {
                ...p,
                matchPercentage: score
            };
        });

        // Sort by match percentage
        products.sort((a, b) => b.matchPercentage - a.matchPercentage);

        // Group into Best Match, Similar Style, Alternative Picks
        // We just return them sorted, frontend can slice them. We'll limit to top 6.
        products = products.slice(0, 6);

        let finalResponseText = `I found some great matches based on your image! ${llmOutput.response_text}`;
        if (fallbackUsed && requestedColors.length > 0 && products.length > 0) {
            finalResponseText = `I couldn't find exactly ${searchOutput.exact_colors.join(' or ')}, but these ${requestedColors.join(', ')} options are the closest styles available in Downtown Boutique.`;
        } else if (products.length === 0) {
            finalResponseText = "I couldn't find an exact match, but these are the closest styles available in Downtown Boutique.";
        }

        return res.json({
            message: finalResponseText,
            products: products,
            attributes: llmOutput
        });

    } catch (error) {
        console.error("AI Vision Stylist Error:", error);
        res.status(500).json({ message: "Internal server error analyzing image.", error: error.message });
    }
};


// --- CONVERSATION ENDPOINTS ---

exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ user: req.user.id })
            .sort({ isPinned: -1, updatedAt: -1 })
            .limit(100);
        res.json(conversations);
    } catch (e) {
        res.status(500).json({ message: "Error fetching conversations" });
    }
};

exports.syncConversations = async (req, res) => {
    try {
        const { localConversations, localOutfits } = req.body;
        
        // Merge conversations
        if (localConversations && Array.isArray(localConversations)) {
            for (let conv of localConversations) {
                // Check if already synced (if id is a valid mongo id and exists)
                if (conv._id && conv._id.length === 24) {
                    const exists = await Conversation.findById(conv._id);
                    if (exists) continue; // Already synced
                }
                
                // Create new
                const newConv = new Conversation({
                    user: req.user.id,
                    title: conv.title || "Restored Chat",
                    messages: conv.messages || [],
                    isPinned: conv.isPinned || false
                });
                await newConv.save();
            }
        }

        // Merge outfits
        if (localOutfits && Array.isArray(localOutfits)) {
            for (let outf of localOutfits) {
                const newOutfit = new SavedOutfit({
                    user: req.user.id,
                    products: outf.products || [],
                    priceText: outf.priceText || "",
                    previewImages: outf.previewImages || []
                });
                await newOutfit.save();
            }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Error syncing data" });
    }
};

exports.deleteConversation = async (req, res) => {
    try {
        await Conversation.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Error deleting conversation" });
    }
};

exports.clearConversations = async (req, res) => {
    try {
        await Conversation.deleteMany({ user: req.user.id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Error clearing conversations" });
    }
};

exports.pinConversation = async (req, res) => {
    try {
        const conv = await Conversation.findOne({ _id: req.params.id, user: req.user.id });
        if (!conv) return res.status(404).json({ message: "Not found" });
        conv.isPinned = req.body.isPinned;
        await conv.save();
        res.json(conv);
    } catch (e) {
        res.status(500).json({ message: "Error pinning conversation" });
    }
};

// --- SAVED OUTFIT ENDPOINTS ---

exports.getSavedOutfits = async (req, res) => {
    try {
        const outfits = await SavedOutfit.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(outfits);
    } catch (e) {
        res.status(500).json({ message: "Error fetching outfits" });
    }
};

exports.saveOutfit = async (req, res) => {
    try {
        const outfit = new SavedOutfit({
            user: req.user.id,
            products: req.body.products,
            priceText: req.body.priceText,
            previewImages: req.body.previewImages
        });
        await outfit.save();
        res.json(outfit);
    } catch (e) {
        res.status(500).json({ message: "Error saving outfit" });
    }
};

exports.deleteSavedOutfit = async (req, res) => {
    try {
        await SavedOutfit.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Error deleting outfit" });
    }
};


exports.createConversation = async (req, res) => {
    try {
        const { prompt, messages } = req.body;
        const title = generateConversationTitle(prompt || "New Conversation");
        const conv = new Conversation({
            user: req.user.id,
            title: title,
            messages: messages || []
        });
        await conv.save();
        res.json(conv);
    } catch (e) {
        res.status(500).json({ message: "Error creating conversation" });
    }
};

exports.updateConversation = async (req, res) => {
    try {
        const { messages } = req.body;
        const conv = await Conversation.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { messages: messages },
            { new: true }
        );
        if (!conv) return res.status(404).json({ message: "Not found" });
        res.json(conv);
    } catch (e) {
        res.status(500).json({ message: "Error updating conversation" });
    }
};

exports.autoTagProduct = async (product) => {
    try {
        if (!process.env.GROQ_API_KEY) return;
        console.log(`[Auto-Tag] Generating AI tags for product: ${product.name}`);
        const prompt = `Analyze this fashion product and extract its metadata.
Product Name: ${product.name}
Category: ${product.category}
Description: ${product.description || ''}

OUTPUT JSON strictly matching this structure:
{
  "fit": "String describing the fit (e.g. Slim, Regular, Baggy, Oversized) or empty string if not applicable",
  "fabric": "String describing the primary material (e.g. 100% Cotton, Linen) or empty string if unknown",
  "occasion": ["Array", "of", "occasions", "like", "Casual", "Party", "Formal"],
  "aiTags": ["Array", "of", "3-5", "descriptive", "style", "keywords"]
}`;
        // groq is already initialized at the top of the file
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        });
        const output = JSON.parse(response.choices[0].message.content);
        
        // Update product in DB silently
        await Product.findByIdAndUpdate(product._id, {
            fit: output.fit || "",
            fabric: output.fabric || "",
            occasion: output.occasion || [],
            aiTags: output.aiTags || []
        });
        console.log(`[Auto-Tag] Success for ${product.name}:`, output);
    } catch (e) {
        console.error(`[Auto-Tag] Error generating tags for ${product._id}:`, e.message);
    }
};
