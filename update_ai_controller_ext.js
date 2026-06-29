const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'controllers/aiController.js');
let code = fs.readFileSync(filePath, 'utf8');

const imports = `
const Conversation = require('../models/Conversation');
const SavedOutfit = require('../models/SavedOutfit');
const jwt = require('jsonwebtoken');

// Helper to extract user ID if token is present
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

const generateConversationTitle = async (prompt) => {
    try {
        const titleResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: \`Generate a very short 2-4 word title for a conversation that starts with this user prompt: "\${prompt}". Example: "Black Outfit", "Party Wear Suggestions", "College Outfit". Do not use quotes in output.\`
        });
        return titleResponse.text.trim().replace(/"/g, '');
    } catch(e) {
        return "New Chat";
    }
};
`;

code = code.replace("const Product = require('../models/Product');", "const Product = require('../models/Product');" + imports);

// We need to inject logic into processChat to save to DB.
// I will replace processChat later or inside this script.
// Let's add the new controller functions.

const newFunctions = `

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
`;

code += newFunctions;

fs.writeFileSync(filePath, code);
console.log("Successfully added conversation routes to aiController.js");
