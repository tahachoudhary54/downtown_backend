const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Product = require("../models/Product");
const { auth, adminAuth } = require("../middleware/authMiddleware");

// GET all categories
router.get("/", async (req, res) => {
  try {
    const filter = {};
    const categories = await Category.find(filter).sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error("Fetch categories error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// POST add new category (Admin)
router.post("/", adminAuth, async (req, res) => {
  try {
    const { name, slug } = req.body;
    
    // Check if category exists
    const exists = await Category.findOne({ $or: [{ name }, { slug }] });
    if (exists) {
      return res.status(400).json({ success: false, message: "Category with this name or slug already exists." });
    }

    const newCategory = new Category({ name, slug });
    await newCategory.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "category", action: "create" });
    }

    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// PUT edit category (Admin)
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { name, slug } = req.body;
    
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
      { name, slug }, 
      { new: true }
    );
    
    if (!updated) return res.status(404).json({ success: false, message: "Category not found" });

    // Optional: if category name changed, we might want to update all products with old category name.
    // For simplicity, we just update the category. In a full system, slug or ID should be referenced.
    
    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "category", action: "update" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// DELETE category (Admin)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // Delete all products using this category
    await Product.deleteMany({ category: category.name });

    await Category.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "category", action: "delete" });
      io.emit("data_updated", { type: "product", action: "delete_many" });
    }

    res.json({ success: true, message: "Category and its associated products deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// POST add a subcategory to a category
router.post("/:id/subcategories", adminAuth, async (req, res) => {
  try {
    const { name, slug } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // Check if subcategory exists
    if (category.subCategories && category.subCategories.find(s => s.name === name || s.slug === slug)) {
      return res.status(400).json({ success: false, message: "Subcategory with this name or slug already exists." });
    }

    if (!category.subCategories) category.subCategories = [];
    category.subCategories.push({ name, slug });
    await category.save();

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error("Add subcategory error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;
