const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Product = require("../models/Product");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// GET all categories
router.get("/", async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const filter = activeOnly === 'true' ? { isActive: true } : {};
    const categories = await Category.find(filter).sort({ displayOrder: 1, name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error("Fetch categories error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// POST add new category (Admin)
router.post("/", auth, adminOnly, async (req, res) => {
  try {
    const { name, slug, img, isActive, displayOrder } = req.body;
    
    // Check if category exists
    const exists = await Category.findOne({ $or: [{ name }, { slug }] });
    if (exists) {
      return res.status(400).json({ success: false, message: "Category with this name or slug already exists." });
    }

    const newCategory = new Category({ name, slug, img, isActive, displayOrder });
    await newCategory.save();
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// PUT edit category (Admin)
router.put("/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, slug, img, isActive, displayOrder } = req.body;
    
    // Check for conflicts
    const exists = await Category.findOne({ 
      $or: [{ name }, { slug }], 
      _id: { $ne: req.params.id } 
    });
    
    if (exists) {
      return res.status(400).json({ success: false, message: "Another category with this name or slug already exists." });
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id, 
      { name, slug, img, isActive, displayOrder }, 
      { new: true }
    );
    
    if (!updated) return res.status(404).json({ success: false, message: "Category not found" });

    // Optional: if category name changed, we might want to update all products with old category name.
    // For simplicity, we just update the category. In a full system, slug or ID should be referenced.
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// DELETE category (Admin)
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // Check if any products use this category
    const productCount = await Product.countDocuments({ category: category.name });
    if (productCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category. There are ${productCount} products assigned to it.` 
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;
