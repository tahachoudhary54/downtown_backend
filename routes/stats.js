const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// GET /api/stats - Admin view store stats
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    
    const revenueAggregation = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$financials.total" }
        }
      }
    ]);

    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

    res.json({ 
      success: true, 
      data: {
        totalOrders,
        totalRevenue
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
