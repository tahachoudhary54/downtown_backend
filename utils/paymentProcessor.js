const Order = require("../models/Order");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const User = require("../models/User");

/**
 * Shared utility to process a successful Razorpay payment.
 * Handles idempotency, stock deductions, and notifications.
 * Can be called safely from both the frontend verification route and the backend webhook.
 */
async function processSuccessfulPayment(razorpayOrderId, razorpayPaymentId, io) {
  try {
    // Atomically find and update the pending order to Paid
    // If it's already Paid, findOneAndUpdate will return null for this query
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId, paymentStatus: 'Pending' },
      { 
        paymentStatus: 'Paid', 
        razorpayPaymentId 
      },
      { new: true }
    );

    if (!order) {
      // Order already processed or not found in Pending state
      const existingOrder = await Order.findOne({ razorpayOrderId });
      if (existingOrder && existingOrder.paymentStatus === 'Paid') {
        // Idempotency: safely ignore if it's already Paid
        return { success: true, message: "Payment already processed", order: existingOrder };
      }
      return { success: false, message: "Order not found or not in Pending state" };
    }

    // --- Stock Deduction and Notifications ---
    const items = order.items;
    const productIds = [...new Set(items.map(item => item.product.toString()))];
    const productsArray = await Product.find({ _id: { $in: productIds } });
    const productsMap = new Map();
    productsArray.forEach(p => productsMap.set(p._id.toString(), p));

    let admins = null;
    let notificationsToInsert = [];

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

    // New order admin notification
    if (!admins) {
      admins = await User.find({ role: "admin" });
    }
    const orderIdDisplay = order._id.toString().slice(-6).toUpperCase();
    const adminNotifs = admins.map(admin => ({
        userId: admin._id,
        orderId: order._id,
        title: "New Order Received",
        message: `Order #${orderIdDisplay} placed by ${order.customer.firstName} ${order.customer.lastName} for ₹${order.financials.total}.`,
        type: "order"
    }));
    notificationsToInsert.push(...adminNotifs);

    // Insert all notifications in bulk
    if (notificationsToInsert.length > 0) {
      await Notification.insertMany(notificationsToInsert);
      
      // Emit real-time admin notification for the new order
      if (io) {
        io.emit("admin_notification", {
          title: "New Order Received",
          desc: `Order #${orderIdDisplay} placed for ₹${order.financials.total}.`,
          type: "order"
        });
      }
    }

    // Create website notification for customer (if logged in)
    if (order.user) {
      await Notification.create({
        userId: order.user,
        orderId: order._id,
        title: "Order Placed",
        message: `Your order #${orderIdDisplay} has been successfully placed.`,
        type: "order_placed"
      });
    }

    if (io) {
      io.emit("data_updated", { type: "order", action: "create" });
    }

    return { success: true, message: "Payment processed and order updated", order };

  } catch (error) {
    console.error("Error processing successful payment:", error);
    return { success: false, message: error.message };
  }
}

module.exports = { processSuccessfulPayment };
