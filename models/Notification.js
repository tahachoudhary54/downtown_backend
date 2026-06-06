const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true }, // e.g., 'order_placed', 'order_shipped'
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: false }, // optional reference to order
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
