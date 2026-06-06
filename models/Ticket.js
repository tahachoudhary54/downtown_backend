const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ["customer", "admin"],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ticketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: String,
    required: false
  },
  subject: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ["Payment Issue", "Delivery Issue", "Wrong Product", "Damaged Product", "Return Request", "Refund Request", "Other"],
    required: true
  },
  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved", "Closed"],
    default: "Open"
  },
  attachments: [{
    type: String // We will store Base64 strings or URLs here
  }],
  messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model("Ticket", ticketSchema);
