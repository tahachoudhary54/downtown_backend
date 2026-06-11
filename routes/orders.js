const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { auth, adminOnly } = require("../middleware/authMiddleware");

const Notification = require("../models/Notification");
const User = require("../models/User");
const Product = require("../models/Product");

// POST /api/orders - Create a new order
router.post("/", async (req, res) => {
  try {
    const { user, customer, shippingAddress, items, financials, paymentMethod } = req.body;

    // Validate stock before creating order
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product ${item.name} not found.` });
      }
      if (!product.inStock || product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}. Only ${product.stock} left.` });
      }
      if (product.inventory && product.inventory.has(item.size)) {
        const sizeStock = product.inventory.get(item.size) || 0;
        if (sizeStock < item.quantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name} (Size: ${item.size}). Only ${sizeStock} left.` });
        }
      }
    }

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

    // Deduct stock and check for low stock
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (product) {
        // Decrease total stock and increment soldCount
        product.stock = Math.max(0, product.stock - item.quantity);
        product.soldCount = (product.soldCount || 0) + item.quantity;
        
        // Decrease specific size inventory if present
        if (product.inventory && product.inventory.has(item.size)) {
          const currentSizeStock = product.inventory.get(item.size) || 0;
          product.inventory.set(item.size, Math.max(0, currentSizeStock - item.quantity));
        }

        // Update inStock flag
        if (product.stock === 0) {
          product.inStock = false;
        }

        await product.save();

        // Emit real-time stock update
        const io = req.app.get("io");
        if (io) {
          io.emit("stock_updated", {
            productId: product._id,
            stock: product.stock,
            inStock: product.inStock,
            inventory: product.inventory
          });
          console.log(`📡 Emitted stock_updated for ${product.name}: ${product.stock} left`);
        }

        // Check for low stock alert
        const threshold = product.lowStockThreshold || 5;
        if (product.stock <= threshold) {
          const admins = await User.find({ role: "admin" });
          const notifications = admins.map(admin => ({
            userId: admin._id,
            title: "Low Stock Alert",
            message: `Product "${product.name}" is running low. Only ${product.stock} left in stock.`,
            type: "stock_alert"
          }));
          if (notifications.length > 0) {
            await Notification.insertMany(notifications);
            if (io) {
              io.emit("admin_notification", {
                title: "Low Stock Alert",
                desc: `Product "${product.name}" is running low. Only ${product.stock} left in stock.`,
                type: "alert"
              });
            }
          }
        }
      }
    }

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
    
    // If cancelling, restore stock
    if (orderStatus === "Cancelled") {
      const existingOrder = await Order.findById(req.params.id);
      if (!existingOrder) return res.status(404).json({ success: false, message: "Order not found" });
      
      // Only restore if it wasn't already cancelled
      if (existingOrder.orderStatus !== "Cancelled") {
        for (const item of existingOrder.items) {
          const product = await Product.findById(item.product);
          if (product) {
            product.stock += item.quantity;
            product.soldCount = Math.max(0, (product.soldCount || 0) - item.quantity);
            if (product.inventory && product.inventory.has(item.size)) {
              product.inventory.set(item.size, (product.inventory.get(item.size) || 0) + item.quantity);
            }
            if (product.stock > 0) {
              product.inStock = true;
            }
            await product.save();
            
            const io = req.app.get("io");
            if (io) {
              io.emit("stock_updated", {
                productId: product._id,
                stock: product.stock,
                inStock: product.inStock,
                inventory: product.inventory
              });
            }
          }
        }
      }
    }

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
