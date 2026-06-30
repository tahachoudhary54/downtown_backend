const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { auth, adminOnly } = require("../middleware/authMiddleware");
const { autoTagProduct } = require("../controllers/aiController");

// GET all products (with optional search query)
router.get("/", async (req, res) => {
  try {
    const { search, category, subCategory, sale, essential, essentialCollection, minPrice, maxPrice, inStock, sort } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }
    if (category) {
      filter.category = { $regex: `^${category.trim()}$`, $options: 'i' };
    }
    if (subCategory) {
      filter.subCategory = { $regex: `^${subCategory.trim()}$`, $options: 'i' };
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

    if (inStock) {
      filter.inStock = inStock === "true";
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let sortOption = { createdAt: -1 };
    if (sort) {
      switch (sort) {
        case 'price-asc':
          sortOption = { priceValue: 1 };
          break;
        case 'price-desc':
          sortOption = { priceValue: -1 };
          break;
        case 'best-selling':
          sortOption = { salesCount: -1, createdAt: -1 };
          break;
        case 'most-popular':
          sortOption = { views: -1, createdAt: -1 };
          break;
        case 'newest':
        default:
          sortOption = { createdAt: -1 };
          break;
      }
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).sort(sortOption).skip(skip).limit(limit);

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
    autoTagProduct(product);

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "product", action: "create" });
    }

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
    
    autoTagProduct(product);

    // Emit real-time stock update
    const io = req.app.get("io");
    if (io) {
      io.emit("stock_updated", {
        productId: product._id,
        stock: product.stock,
        inStock: product.inStock,
        inventory: product.inventory,
        variants: product.variants,
        price: product.price,
        salePrice: product.salePrice
      });
      io.emit("data_updated", { type: "product", action: "update" });
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
    
    const io = req.app.get('io');
    if (io) {
      io.emit("stock_updated", {
        productId: product._id,
        stock: 0,
        inStock: false,
        inventory: {},
        variants: []
      });
      io.emit("data_updated", { type: "product", action: "delete" });
    }

    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
