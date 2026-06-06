require("dotenv").config({ path: __dirname + '/../.env' });
const mongoose = require("mongoose");
const Order = require("../models/Order");

const seedOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing orders just in case
    await Order.deleteMany({});
    
    // Seed 5 dummy orders
    const dummyOrders = [
      {
        customer: { firstName: "Aman", lastName: "Gupta", email: "aman@example.com", phone: "+91 9876543210" },
        shippingAddress: { address: "123 MG Road", city: "Mumbai", pinCode: "400001" },
        items: [{ product: new mongoose.Types.ObjectId(), name: "Classic T-Shirt", size: "M", quantity: 2, price: 999 }],
        financials: { subtotal: 1998, shippingCost: 0, total: 1998 },
        paymentMethod: "upi",
        paymentStatus: "Paid",
        orderStatus: "Delivered"
      },
      {
        customer: { firstName: "Priya", lastName: "Sharma", email: "priya@example.com", phone: "+91 9876543211" },
        shippingAddress: { address: "456 Connaught Place", city: "New Delhi", pinCode: "110001" },
        items: [{ product: new mongoose.Types.ObjectId(), name: "Loose Fit Baggy Jeans", size: "S", quantity: 1, price: 2500 }],
        financials: { subtotal: 2500, shippingCost: 0, total: 2500 },
        paymentMethod: "netbanking",
        paymentStatus: "Paid",
        orderStatus: "Shipped"
      },
      {
        customer: { firstName: "Rahul", lastName: "Verma", email: "rahul@example.com", phone: "+91 9876543212" },
        shippingAddress: { address: "789 Brigade Road", city: "Bangalore", pinCode: "560001" },
        items: [{ product: new mongoose.Types.ObjectId(), name: "Summer Linen Shirt", size: "L", quantity: 1, price: 1500 }],
        financials: { subtotal: 1500, shippingCost: 0, total: 1500 },
        paymentMethod: "upi",
        paymentStatus: "Paid",
        orderStatus: "Processing"
      },
      {
        customer: { firstName: "Sneha", lastName: "Patil", email: "sneha@example.com", phone: "+91 9876543213" },
        shippingAddress: { address: "101 Koregaon Park", city: "Pune", pinCode: "411001" },
        items: [{ product: new mongoose.Types.ObjectId(), name: "Formal Trousers", size: "M", quantity: 2, price: 2000 }],
        financials: { subtotal: 4000, shippingCost: 0, total: 4000 },
        paymentMethod: "netbanking",
        paymentStatus: "Paid",
        orderStatus: "Delivered"
      },
      {
        customer: { firstName: "Vikram", lastName: "Singh", email: "vikram@example.com", phone: "+91 9876543214" },
        shippingAddress: { address: "202 Banjara Hills", city: "Hyderabad", pinCode: "500034" },
        items: [{ product: new mongoose.Types.ObjectId(), name: "Casual Sneakers", size: "9", quantity: 1, price: 3500 }],
        financials: { subtotal: 3500, shippingCost: 0, total: 3500 },
        paymentMethod: "upi",
        paymentStatus: "Paid",
        orderStatus: "Shipped"
      }
    ];

    await Order.insertMany(dummyOrders);
    console.log("✅ Seeded 5 dummy orders!");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
};

seedOrders();
