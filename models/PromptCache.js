const mongoose = require('mongoose');

const PromptCacheSchema = new mongoose.Schema({
    cacheKey: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    intentData: { 
        type: Object, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now, 
        expires: 86400 // Automatically delete document after 24 hours (86400 seconds)
    }
});

module.exports = mongoose.model('PromptCache', PromptCacheSchema);
