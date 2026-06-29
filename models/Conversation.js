const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "ai"], required: true },
    type: { type: String, enum: ["text", "image", "products", "outfits"], required: true },
    content: { type: String },
    url: { type: String },
    data: { type: mongoose.Schema.Types.Mixed } // Stores product arrays or outfit arrays
});

const conversationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        title: { type: String, default: "New Chat" },
        messages: [messageSchema],
        isPinned: { type: Boolean, default: false }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
