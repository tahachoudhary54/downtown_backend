const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { auth, adminOnly } = require("../middleware/authMiddleware");
const NodeCache = require("node-cache");

const productCache = new NodeCache({ stdTTL: 300, checkperiod: 320 }); // 5 minutes cache

// GET all products (with optional search query)
router.get("/", async (req, res) => {
  try {
    const cacheKey = req.originalUrl;
    if (productCache.has(cacheKey)) {
      return res.json(productCache.get(cacheKey));
    }

    const { search, category, sale, essential, essentialCollection, minPrice, maxPrice } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }
    if (category) {
      // Products now store exact sub-category names (e.g. "BAGGY SHIRT", "POLO T-SHIRT", "BAGGY JEANS")
      // Use case-insensitive exact match
      filter.category = { $regex: `^${category.trim()}$`, $options: 'i' };
    }
    if (sale === "true") {
      filter.isOnSale = true;
    }
    if (essential === "true") {
      filter.isEssential = true;
    }
    if (essentialCollection) {
      filter.essentialCollection = { $regex: `^${essentialCollection.trim()}$`, $options: 'i' };
    }
    
    if (minPrice || maxPrice) {
      filter.priceValue = {};
      if (minPrice) filter.priceValue.$gte = Number(minPrice);
      if (maxPrice) filter.priceValue.$lte = Number(maxPrice);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

    // Calculate category counts independent of the current category filter
    const baseFilter = { ...filter };
    delete baseFilter.category;
    delete baseFilter.$and;
    const countsAggr = await Product.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const categoryCounts = {};
    countsAggr.forEach(c => {
      if (c._id) categoryCounts[c._id.toLowerCase()] = c.count;
    });

    const totalPages = Math.ceil(total / limit);
    const responseData = { 
      success: true, 
      data: products, 
      categoryCounts,
      pagination: { 
        totalProducts: total, 
        currentPage: page, 
        limit, 
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      } 
    };
    
    productCache.set(cacheKey, responseData);
    res.json(responseData);
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
    productCache.flushAll(); // Invalidate cache
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
        inventory: product.inventory,
        variants: product.variants
      });
      console.log(`📡 Emitted stock_updated for ${product.name}: ${product.stock} left (Admin Edit)`);
    }

    productCache.flushAll(); // Invalidate cache
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
    
    const io = req.app.get('socketio');
    if (io) {
      io.emit("stock_updated", {
        productId: product._id,
        stock: 0,
        inStock: false,
        inventory: {},
        variants: []
      });
    }

    productCache.flushAll(); // Invalidate cache
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
