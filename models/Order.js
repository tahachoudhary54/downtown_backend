const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    customer: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      pinCode: { type: String, required: true },
    },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        name: { type: String, required: true },
        size: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      }
    ],
    financials: {
      subtotal: { type: Number, required: true },
      shippingCost: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },
    deliveryCharge: { type: Number, default: null },
    paymentMethod: { type: String, required: true }, // 'upi' or 'netbanking'
    paymentStatus: { type: String, default: 'Pending' }, // 'Pending', 'Paid', 'Failed'
    orderStatus: { type: String, default: 'Pending Delivery Quote' }, // 'Pending Delivery Quote', 'Waiting for Customer Confirmation', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
