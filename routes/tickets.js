const express = require("express");
const router = express.Router();
const Ticket = require("../models/Ticket");
const Notification = require("../models/Notification");
const { auth, adminOnly } = require("../middleware/authMiddleware");

// POST /api/tickets - Customer creates a new ticket
router.post("/", auth, async (req, res) => {
  try {
    const { subject, category, description, orderId, attachments } = req.body;
    
    if (!subject || !category || !description) {
      return res.status(400).json({ success: false, message: "Please provide subject, category, and description" });
    }

    const ticket = new Ticket({
      user: req.user.id,
      orderId,
      subject,
      category,
      attachments: attachments || [],
      messages: [{
        sender: "customer",
        text: description
      }]
    });

    await ticket.save();

    // Trigger Admin Notification (currently handled locally in Admin panel but if we implement a backend global admin channel, do it here)

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tickets/my-tickets - Customer view their tickets
router.get("/my-tickets", auth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id }).sort({ updatedAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tickets - Admin view all tickets
router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const tickets = await Ticket.find().populate("user", "name email").sort({ updatedAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tickets/:id - View specific ticket details
router.get("/:id", auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate("user", "name email");
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    // Ensure customer can only view their own ticket
    if (req.user.role !== "admin" && ticket.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to view this ticket" });
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/tickets/:id/reply - Add a reply to a ticket
router.put("/:id/reply", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "Message text is required" });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    const isCustomer = req.user.role !== "admin";

    // Ensure customer can only reply to their own ticket
    if (isCustomer && ticket.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const sender = isCustomer ? "customer" : "admin";
    
    // Automatically reopen ticket if customer replies to a resolved/closed one
    if (isCustomer && (ticket.status === "Resolved" || ticket.status === "Closed")) {
      ticket.status = "Open";
    }

    ticket.messages.push({ sender, text });
    ticket.updatedAt = Date.now();
    await ticket.save();

    // If admin replies, notify the customer
    if (!isCustomer) {
      const ticketIdDisplay = ticket._id.toString().slice(-6).toUpperCase();
      await Notification.create({
        userId: ticket.user,
        title: "Support Ticket Reply",
        message: `Admin replied to your ticket #${ticketIdDisplay}.`,
        type: "ticket_reply"
      });
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/tickets/:id/status - Admin change ticket status
router.put("/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    ticket.status = status;
    await ticket.save();

    // Notify customer
    const ticketIdDisplay = ticket._id.toString().slice(-6).toUpperCase();
    await Notification.create({
      userId: ticket.user,
      title: "Ticket Status Updated",
      message: `Your ticket #${ticketIdDisplay} is now ${status}.`,
      type: "ticket_status"
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/tickets/:id - Admin delete a ticket
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    res.json({ success: true, message: "Ticket deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
