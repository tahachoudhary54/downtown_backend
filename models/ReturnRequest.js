const mongoose = require('mongoose');

const returnRequestSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: [true, 'Order ID is required']
  },
  name: {
    type: String,
    required: [true, 'Full Name is required']
  },
  email: {
    type: String,
    required: [true, 'Email Address is required']
  },
  phone: {
    type: String,
    required: [true, 'Phone Number is required']
  },
  requestType: {
    type: String,
    required: [true, 'Request Type is required'],
    enum: ['Return', 'Exchange']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    enum: ['Wrong Size', 'Damaged Product', 'Wrong Product Received', 'Quality Issue', 'Other']
  },
  message: {
    type: String,
    required: false
  },
  images: {
    type: [String],
    default: []
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for backward compatibility with old requests
  },
  adminRemarks: {
    type: String,
    default: ''
  },
  internalNotes: {
    type: String,
    default: ''
  },
  refundStatus: {
    type: String,
    enum: ['Pending', 'Processed', 'Not Applicable'],
    default: 'Pending'
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'],
    default: 'Pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
