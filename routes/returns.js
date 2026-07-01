const express = require('express');
const router = express.Router();
const ReturnRequest = require('../models/ReturnRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, adminAuth } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/email');

// @route   POST /api/returns
// @desc    Create a new return/exchange request
// @access  Public
router.post('/', auth, async (req, res) => {
  try {
    const { orderId, name, email, phone, requestType, reason, message, images } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!orderId || !name || !email || !phone || !requestType || !reason) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Prevent duplicate active requests for the same order
    const existingActiveRequest = await ReturnRequest.findOne({
      orderId,
      status: { $in: ['Pending', 'Under Review', 'Approved'] }
    });

    if (existingActiveRequest) {
      return res.status(400).json({ 
        success: false, 
        message: 'A return/exchange request for this order is already in progress.' 
      });
    }

    const returnRequest = await ReturnRequest.create({
      orderId,
      userId,
      name,
      email,
      phone,
      requestType,
      reason,
      message,
      images
    });

    // Send email to store owner
    const adminEmailHtml = `
      <h3>New ${requestType} Request</h3>
      <p><strong>Customer Name:</strong> ${name}</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Message:</strong> ${message || 'N/A'}</p>
      <p>Please check the admin panel for more details and images.</p>
    `;
    
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@downtownboutique.com',
      subject: `New ${requestType} Request - Order ${orderId}`,
      html: adminEmailHtml,
      replyTo: email
    });

    // Send email to customer
    const customerEmailHtml = `
      <p>Dear ${name},</p>
      <p>We have successfully received your request. Our support team will review it and contact you shortly.</p>
      <p>Best regards,<br/>Downtown Boutique Team</p>
    `;

    await sendEmail({
      to: email,
      subject: 'Return/Exchange Request Received',
      html: customerEmailHtml
    });

    // Notify admins via database and socket
    const admins = await User.find({ role: "admin" });
    const notifications = admins.map(admin => ({
      userId: admin._id,
      title: `New ${requestType} Request`,
      message: `Customer ${name} submitted a new ${requestType.toLowerCase()} request for order ${orderId}.`,
      type: "return_request"
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      const io = req.app.get("io");
      if (io) {
        io.emit("admin_notification", {
          title: `New ${requestType} Request`,
          desc: `Customer ${name} submitted a new ${requestType.toLowerCase()} request for order ${orderId}.`,
          type: "return_request"
        });
        io.emit("data_updated", { type: "return_request", action: "create" });
      }
    }

    res.status(201).json({ success: true, data: returnRequest });
  } catch (error) {
    console.error('Error creating return request:', error);
    res.status(500).json({ success: false, message: 'Server error while submitting request' });
  }
});

// @route   GET /api/returns/myreturns
// @desc    Get logged in user's return requests
// @access  Private
router.get('/myreturns', auth, async (req, res) => {
  try {
    const requests = await ReturnRequest.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching my returns:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/returns/myreturns/:id
// @desc    Get logged in user's specific return request
// @access  Private
router.get('/myreturns/:id', auth, async (req, res) => {
  try {
    const request = await ReturnRequest.findOne({ _id: req.params.id, userId: req.user.id });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Error fetching my return:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/returns
// @desc    Get all return/exchange requests
// @access  Private/Admin
router.get('/', adminAuth, async (req, res) => {
  try {
    const requests = await ReturnRequest.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/returns/:id
// @desc    Get return/exchange request by ID
// @access  Private/Admin
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const request = await ReturnRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Error fetching return request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/admin/returns/:id
// @desc    Update return/exchange request status
// @access  Private/Admin
router.patch('/:id', adminAuth, async (req, res) => {
  try {
    const { status, adminRemarks, internalNotes, refundStatus } = req.body;
    const request = await ReturnRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    let isStatusChanged = false;
    if (status && request.status !== status) {
      request.status = status;
      isStatusChanged = true;
    }

    if (adminRemarks !== undefined) request.adminRemarks = adminRemarks;
    if (internalNotes !== undefined) request.internalNotes = internalNotes;
    if (refundStatus !== undefined) request.refundStatus = refundStatus;

    await request.save();

    if (isStatusChanged) {
      // Send email to customer about status update
      const customerEmailHtml = `
        <p>Dear ${request.name},</p>
        <p>Your ${request.requestType.toLowerCase()} request for order ${request.orderId} has been updated to <strong>${status}</strong>.</p>
        ${request.adminRemarks ? `<p><strong>Remarks from our team:</strong> ${request.adminRemarks}</p>` : ''}
        <p>Please check your account for more details.</p>
        <p>Best regards,<br/>Downtown Boutique Team</p>
      `;

      await sendEmail({
        to: request.email,
        subject: `Update on your ${request.requestType} Request - Order ${request.orderId}`,
        html: customerEmailHtml
      }).catch(err => console.error("Failed to send status update email:", err));

      // Create notification for customer
      const user = await User.findOne({ email: request.email }).select('_id').lean();
      if (user) {
        await Notification.create({
          userId: user._id,
          title: "Return Request Updated",
          message: `Your return/exchange request for order ${request.orderId} has been updated to ${status}.`,
          type: "return_updated"
        });
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("data_updated", { type: "return_request", action: "update" });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Error updating return request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/admin/returns/:id
// @desc    Delete return/exchange request
// @access  Private/Admin
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const request = await ReturnRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    await request.deleteOne();
    res.status(200).json({ success: true, message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting return request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
