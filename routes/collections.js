const express = require("express");
const router = express.Router();
const Collection = require("../models/Collection");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// GET all collections
router.get("/", async (req, res) => {
  try {
    const collections = await Collection.find().sort({ homepageOrder: 1, createdAt: -1 });
    res.json({ success: true, data: collections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single collection by id
router.get("/:id", async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ success: false, message: "Collection not found" });
    res.json({ success: true, data: collection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create a new collection
router.post("/", auth, adminOnly, async (req, res) => {
  try {
    const collection = new Collection(req.body);
    await collection.save();
    res.status(201).json({ success: true, data: collection });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update a collection
router.put("/:id", auth, adminOnly, async (req, res) => {
  try {
    const collection = await Collection.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!collection) return res.status(404).json({ success: false, message: "Collection not found" });
    res.json({ success: true, data: collection });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE a collection
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id);
    if (!collection) return res.status(404).json({ success: false, message: "Collection not found" });
    res.json({ success: true, message: "Collection deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
