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
      shippingCost: { type: Number, required: true },
      total: { type: Number, required: true },
    },
    paymentMethod: { type: String, required: true }, // 'upi' or 'netbanking'
    paymentStatus: { type: String, default: 'Pending' }, // 'Pending', 'Paid', 'Failed'
    orderStatus: { type: String, default: 'Processing' }, // 'Processing', 'Shipped', 'Delivered'
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
