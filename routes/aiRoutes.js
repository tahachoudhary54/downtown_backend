const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

const { auth } = require('../middleware/authMiddleware');

router.post('/chat', aiController.processChat);
router.post('/vision-search', express.json({ limit: '10mb' }), aiController.processVisionSearch);

// Conversation Management
router.get('/conversations', auth, aiController.getConversations);
router.post('/conversations', auth, aiController.createConversation);
router.put('/conversations/:id', auth, aiController.updateConversation);
router.post('/conversations/sync', auth, aiController.syncConversations);
router.delete('/conversations/:id', auth, aiController.deleteConversation);
router.delete('/conversations', auth, aiController.clearConversations);
router.put('/conversations/:id/pin', auth, aiController.pinConversation);

// Saved Outfits
router.get('/saved-outfits', auth, aiController.getSavedOutfits);
router.post('/saved-outfits', auth, aiController.saveOutfit);
router.delete('/saved-outfits/:id', auth, aiController.deleteSavedOutfit);

module.exports = router;
