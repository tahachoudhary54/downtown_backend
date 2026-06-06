const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { auth, adminOnly } = require("../middleware/authMiddleware");
const whatsappService = require("../services/whatsappService");
const Notification = require("../models/Notification");
const User = require("../models/User");

// POST /api/orders - Create a new order
router.post("/", async (req, res) => {
  try {
    const { user, customer, shippingAddress, items, financials, paymentMethod } = req.body;

    const order = new Order({
      user,
      customer,
      shippingAddress,
      items,
      financials,
      paymentMethod,
      paymentStatus: "Paid", // Mocking success immediately for now
      orderStatus: "Processing"
    });

    await order.save();

    // Create website notification for customer (if logged in)
    if (user) {
      const orderIdDisplay = order._id.toString().slice(-6).toUpperCase();
      await Notification.create({
        userId: user,
        orderId: order._id,
        title: "Order Placed",
        message: `Your order #${orderIdDisplay} has been successfully placed.`,
        type: "order_placed"
      });
    }
    
    // Trigger WhatsApp notification asynchronously (do not await, so user isn't blocked if Twilio is slow)
    whatsappService.sendAdminOrderAlert(order).catch(err => console.error("WhatsApp trigger error:", err));

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/orders - Admin view all orders
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/myorders - Customer view their own orders
router.get("/myorders", auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/:id/status - Admin update order status
router.put("/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Create status update notification for customer
    let userIdForNotification = order.user;
    if (!userIdForNotification && order.customer && order.customer.email) {
      // Try to find user by email if order.user is missing
      const user = await User.findOne({ email: order.customer.email }).select('_id').lean();
      if (user) {
        userIdForNotification = user._id;
      }
    }

    if (userIdForNotification) {
      const orderIdDisplay = order._id.toString().slice(-6).toUpperCase();
      let title = "Order Updated";
      let message = `Your order #${orderIdDisplay} has been updated to ${orderStatus}.`;
      let type = "order_updated";

      if (orderStatus === "Shipped") {
        title = "Order Shipped";
        message = `Your order #${orderIdDisplay} has been shipped and is on the way.`;
        type = "order_shipped";
      } else if (orderStatus === "Delivered") {
        title = "Order Delivered";
        message = `Your order #${orderIdDisplay} has been delivered successfully.`;
        type = "order_delivered";
      } else if (orderStatus === "Cancelled") {
        title = "Order Cancelled";
        message = `Your order #${orderIdDisplay} has been cancelled.`;
        type = "order_cancelled";
      }

      await Notification.create({
        userId: userIdForNotification,
        orderId: order._id,
        title,
        message,
        type
      });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/orders/:id - Admin delete order
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
