const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// Helper function to update Product aggregate ratings
const updateProductAggregate = async (productId) => {
  const reviews = await Review.find({ product: productId, status: 'Approved' });
  
  if (reviews.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      averageRating: 0,
      reviewCount: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    });
    return;
  }

  let totalRating = 0;
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  reviews.forEach(review => {
    totalRating += review.rating;
    distribution[review.rating.toString()] += 1;
  });

  const averageRating = (totalRating / reviews.length).toFixed(1);

  await Product.findByIdAndUpdate(productId, {
    averageRating: parseFloat(averageRating),
    reviewCount: reviews.length,
    ratingDistribution: distribution
  });
};

// GET /api/reviews/product/:id
// Public: Fetch approved reviews for a product with pagination, filtering, and sorting
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'recent', rating, hasImages, verifiedOnly } = req.query;

    const query = { product: productId, status: 'Approved' };

    // Filtering
    if (rating) query.rating = parseInt(rating);
    if (hasImages === 'true') query.images = { $exists: true, $not: { $size: 0 } };
    if (verifiedOnly === 'true') query.isVerifiedPurchase = true;

    // Sorting
    let sortObj = { createdAt: -1 };
    if (sort === 'highest') sortObj = { rating: -1, createdAt: -1 };
    if (sort === 'lowest') sortObj = { rating: 1, createdAt: -1 };
    if (sort === 'helpful') sortObj = { helpfulVotes: -1, createdAt: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(query)
      .populate("user", "name email")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error fetching reviews." });
  }
});

// POST /api/reviews
// Private: Submit a new review
router.post("/", auth, async (req, res) => {
  try {
    const { product: productId, rating, title, text, images } = req.body;
    const userId = req.user.id;

    // Check for duplicate review
    const existingReview = await Review.findOne({ user: userId, product: productId });
    if (existingReview) {
      return res.status(400).json({ success: false, message: "You have already reviewed this product." });
    }

    // Check if user purchased the product
    const orders = await Order.find({ user: userId, orderStatus: { $in: ['Delivered', 'Shipped', 'Confirmed'] } });
    let isVerifiedPurchase = false;

    // Loop through user orders to see if the product is there
    for (const order of orders) {
      const hasPurchased = order.items.some(item => item.product.toString() === productId);
      if (hasPurchased) {
        isVerifiedPurchase = true;
        break;
      }
    }

    // Optional: Only allow if purchased. Or just mark as verified. Requirement says "only for products they have purchased"
    if (!isVerifiedPurchase) {
      return res.status(403).json({ success: false, message: "You can only review products you have purchased." });
    }

    const review = new Review({
      user: userId,
      product: productId,
      rating,
      title,
      text,
      images: images || [],
      isVerifiedPurchase,
      status: 'Approved' // Auto-approve by default, can be changed via admin
    });

    await review.save();

    // Update aggregate
    await updateProductAggregate(productId);

    // Notify admins
    const productData = await Product.findById(productId);
    const productName = productData ? productData.name : "a product";
    
    const admins = await User.find({ role: "admin" });
    const notifications = admins.map(admin => ({
      userId: admin._id,
      title: "New Review Submitted",
      message: `A new ${rating}-star review was submitted for "${productName}".`,
      type: "new_review"
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      const io = req.app.get("io");
      if (io) {
        io.emit("admin_notification", {
          title: "New Review Submitted",
          desc: `A new ${rating}-star review was submitted for "${productName}".`,
          type: "new_review"
        });
      }
    }

    res.status(201).json({ success: true, data: review, message: "Review submitted successfully." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already reviewed this product." });
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to submit review." });
  }
});

// PUT /api/reviews/:id/helpful
// Private: Toggle helpful vote
router.put("/:id/helpful", auth, async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user.id;

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    const hasVoted = review.helpfulBy.includes(userId);

    if (hasVoted) {
      // Remove vote
      review.helpfulBy = review.helpfulBy.filter(id => id.toString() !== userId);
      review.helpfulVotes -= 1;
    } else {
      // Add vote
      review.helpfulBy.push(userId);
      review.helpfulVotes += 1;
    }

    await review.save();
    res.json({ success: true, helpfulVotes: review.helpfulVotes, hasVoted: !hasVoted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/reviews/:id/report
// Private: Report a review
router.put("/:id/report", auth, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { $inc: { reportCount: 1 } }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    
    res.json({ success: true, message: "Review reported successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/reviews/:id
// Private: Delete own review
router.delete("/:id", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Not authorized to delete this review" });
    }

    await Review.findByIdAndDelete(req.params.id);
    await updateProductAggregate(review.product);

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- ADMIN ROUTES ---

// GET /api/reviews/admin
// Admin: Fetch all reviews
router.get("/admin/all", auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, product, search } = req.query;
    
    const query = {};
    if (status && status !== 'All') query.status = status;
    if (product) query.product = product;
    
    // Simple text search on title or text if needed (requires text index or regex)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(query)
      .populate("user", "name email")
      .populate("product", "name img")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/reviews/admin/:id/status
// Admin: Update review status
router.put("/admin/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Pending', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    // Update aggregate
    await updateProductAggregate(review.product);

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "review", action: "update" });
    }

    res.json({ success: true, data: review, message: `Review ${status.toLowerCase()} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/reviews/admin/analytics
// Admin: Reviews analytics dashboard data
router.get("/admin/analytics", auth, adminOnly, async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments();
    const approvedReviews = await Review.countDocuments({ status: 'Approved' });
    const pendingReviews = await Review.countDocuments({ status: 'Pending' });
    const reportedReviews = await Review.countDocuments({ reportCount: { $gt: 0 } });

    // Average rating across all approved reviews
    const avgData = await Review.aggregate([
      { $match: { status: 'Approved' } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } }
    ]);
    const overallAverageRating = avgData.length > 0 ? avgData[0].avgRating.toFixed(1) : 0;

    // Review trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const trends = await Review.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Most reviewed products
    const mostReviewed = await Product.find({ reviewCount: { $gt: 0 } })
      .sort({ reviewCount: -1 })
      .limit(5)
      .select('name img reviewCount averageRating');

    // Lowest rated products (with at least 1 review)
    const lowestRated = await Product.find({ reviewCount: { $gt: 0 } })
      .sort({ averageRating: 1 })
      .limit(5)
      .select('name img reviewCount averageRating');

    res.json({
      success: true,
      data: {
        totalReviews,
        approvedReviews,
        pendingReviews,
        reportedReviews,
        overallAverageRating,
        trends,
        mostReviewed,
        lowestRated
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/reviews/admin/:id
// Admin: Delete review
router.delete("/admin/:id", auth, adminOnly, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    await updateProductAggregate(review.product);

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "review", action: "delete" });
    }

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
