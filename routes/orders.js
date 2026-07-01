const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { auth, adminAuth } = require("../middleware/authMiddleware");

const Notification = require("../models/Notification");
const User = require("../models/User");
const Product = require("../models/Product");

// POST /api/orders - Create a new order
router.post("/", async (req, res) => {
  try {
    const { user, customer, shippingAddress, items, financials, paymentMethod, razorpayOrderId, razorpayPaymentId } = req.body;

    // Fetch all products involved in the order at once
    const productIds = [...new Set(items.map(item => item.product.toString()))];
    const productsArray = await Product.find({ _id: { $in: productIds } });
    
    // Map products for quick lookup
    const productsMap = new Map();
    productsArray.forEach(p => productsMap.set(p._id.toString(), p));

    // Validate stock before creating order
    for (const item of items) {
      const productIdStr = item.product.toString();
      const product = productsMap.get(productIdStr);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product ${item.name} not found.` });
      }
      if (!product.inStock) {
        return res.status(400).json({ success: false, message: `Product ${product.name} is currently unavailable for purchase.` });
      }
      if (product.stock < item.quantity) {
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
      razorpayOrderId,
      razorpayPaymentId,
      paymentStatus: "Paid", // Mocking success immediately for now
      orderStatus: "Pending Delivery Quote"
    });

    await order.save();

    // Deduct stock and check for low stock
    let admins = null;
    let notificationsToInsert = [];
    const io = req.app.get("io");

    for (const item of items) {
      const productIdStr = item.product.toString();
      const product = productsMap.get(productIdStr);
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

        // Check for low stock alert
        const threshold = product.lowStockThreshold || 5;
        if (product.stock <= threshold) {
          if (!admins) {
            admins = await User.find({ role: "admin" });
          }
          admins.forEach(admin => {
            notificationsToInsert.push({
              userId: admin._id,
              title: "Low Stock Alert",
              message: `Product "${product.name}" is running low. Only ${product.stock} left in stock.`,
              type: "stock_alert"
            });
          });
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

    // Save all updated products in parallel
    await Promise.all(Array.from(productsMap.values()).map(async (product) => {
      await product.save();
      // Emit real-time stock update
      if (io) {
        io.emit("stock_updated", {
          productId: product._id,
          stock: product.stock,
          inStock: product.inStock,
          inventory: product.inventory,
          variants: product.variants
        });
        console.log(`📡 Emitted stock_updated for ${product.name}: ${product.stock} left`);
      }
    }));

    // Insert all notifications in bulk
    if (notificationsToInsert.length > 0) {
      await Notification.insertMany(notificationsToInsert);
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

    if (io) {
      io.emit("data_updated", { type: "order", action: "create" });
    }
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/orders - Admin view all orders
router.get("/", adminAuth, async (req, res) => {
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
router.put("/:id/status", adminAuth, async (req, res) => {
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
                inventory: product.inventory,
                variants: product.variants
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

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "order", action: "update" });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/orders/:id - Admin or Owner delete order
router.delete("/:id", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const isAdmin = req.user && req.user.role === "admin";
    if (!isAdmin && (!order.user || order.user.toString() !== req.user.id)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Restore stock if it wasn't already cancelled
    if (order.orderStatus !== "Cancelled") {
      for (const item of order.items) {
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
              inventory: product.inventory,
              variants: product.variants
            });
          }
        }
      }
    }

    await Order.findByIdAndDelete(req.params.id);
    const io_del = req.app.get("io");
    if (io_del) {
      io_del.emit("data_updated", { type: "order", action: "delete" });
    }
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/:id/delivery-quote - Admin set delivery charge
router.put("/:id/delivery-quote", adminAuth, async (req, res) => {
  try {
    const { deliveryCharge } = req.body;
    if (deliveryCharge === undefined || deliveryCharge === null) {
      return res.status(400).json({ success: false, message: "Delivery charge is required." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.deliveryCharge = Number(deliveryCharge);
    order.orderStatus = "Waiting for Customer Confirmation";
    // Optional: add to financials total
    order.financials.shippingCost = Number(deliveryCharge);
    order.financials.total = order.financials.subtotal + Number(deliveryCharge);

    await order.save();

    // Create notification for customer
    let userIdForNotification = order.user;
    if (!userIdForNotification && order.customer && order.customer.email) {
      const user = await User.findOne({ email: order.customer.email }).select('_id').lean();
      if (user) userIdForNotification = user._id;
    }

    if (userIdForNotification) {
      await Notification.create({
        userId: userIdForNotification,
        orderId: order._id,
        title: "Delivery Quote Received",
        message: `Your delivery charge is ₹${deliveryCharge}. Please confirm to proceed.`,
        type: "delivery_quote"
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "order", action: "update" });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/:id/confirm-delivery - Customer confirm delivery
router.put("/:id/confirm-delivery", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.user && order.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    order.orderStatus = "Confirmed";
    await order.save();

    // Notify admins
    const admins = await User.find({ role: "admin" });
    const notifications = admins.map(admin => ({
      userId: admin._id,
      orderId: order._id,
      title: "Delivery Charge Confirmed",
      message: `Customer confirmed delivery charge for order #${order._id.toString().slice(-6).toUpperCase()}. Ready for dispatch.`,
      type: "order_confirmed"
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      const io = req.app.get("io");
      if (io) {
        io.emit("admin_notification", {
          title: "Delivery Charge Confirmed",
          desc: `Order #${order._id.toString().slice(-6).toUpperCase()} is ready for dispatch.`,
          type: "order_confirmed"
        });
      }
    }

    const io_update = req.app.get("io");
    if (io_update) {
      io_update.emit("data_updated", { type: "order", action: "update" });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/:id/cancel - Customer cancel order
router.put("/:id/cancel", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.user && order.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (order.orderStatus === "Cancelled") {
       return res.status(400).json({ success: false, message: "Order is already cancelled" });
    }

    order.orderStatus = "Cancelled";
    await order.save();

    // Restore stock
    for (const item of order.items) {
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
            inventory: product.inventory,
            variants: product.variants
          });
        }
      }
    }

    // Notify admins
    const admins = await User.find({ role: "admin" });
    const notifications = admins.map(admin => ({
      userId: admin._id,
      orderId: order._id,
      title: "Order Cancelled",
      message: `Customer cancelled order #${order._id.toString().slice(-6).toUpperCase()}.`,
      type: "order_cancelled"
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      const io = req.app.get("io");
      if (io) {
        io.emit("admin_notification", {
          title: "Order Cancelled",
          desc: `Order #${order._id.toString().slice(-6).toUpperCase()} was cancelled.`,
          type: "order_cancelled"
        });
      }
    }

    const io_update2 = req.app.get("io");
    if (io_update2) {
      io_update2.emit("data_updated", { type: "order", action: "update" });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
