const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { auth, adminAuth } = require('../middleware/authMiddleware');

// @route   POST /api/upload
// @desc    Upload an image to Cloudinary
// @access  Admin Only
router.post('/', auth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Cloudinary returns the secure URL in the path property of the file
    res.status(200).json({ 
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: req.file.path
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;
