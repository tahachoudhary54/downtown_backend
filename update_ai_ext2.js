const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'controllers/aiController.js');
let code = fs.readFileSync(filePath, 'utf8');

const newFuncs = `

exports.createConversation = async (req, res) => {
    try {
        const { prompt, messages } = req.body;
        const title = await generateConversationTitle(prompt || "New Conversation");
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
`;

code += newFuncs;
fs.writeFileSync(filePath, code);
console.log("Successfully added create/update routes");
