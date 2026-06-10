const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// GET all products (with optional search query)
router.get("/", async (req, res) => {
  try {
    const { search, category, sale } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }
    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }
    if (sale === "true") {
      filter.isOnSale = true;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

    res.json({ 
      success: true, 
      data: products, 
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create a new product
router.post("/", auth, adminOnly, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update a product
router.put("/:id", auth, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // Emit real-time stock update
    const io = req.app.get("io");
    if (io) {
      io.emit("stock_updated", {
        productId: product._id,
        stock: product.stock,
        inStock: product.inStock,
        inventory: product.inventory
      });
      console.log(`📡 Emitted stock_updated for ${product.name}: ${product.stock} left (Admin Edit)`);
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE a product
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
