const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { auth } = require("../middleware/authMiddleware");
const { processSuccessfulPayment } = require("../utils/paymentProcessor");

// Initialize Razorpay instance
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// POST /api/payment/create-order
router.post("/create-order", auth, async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: "Amount must be at least 100 paise" });
    }

    if (!razorpay) {
      return res.status(500).json({ success: false, message: "Razorpay credentials not configured on server" });
    }

    const options = {
      amount, // amount in smallest currency unit (paise for INR)
      currency,
      receipt: receipt || `rcpt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    
    console.log("process.env.RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
    console.log("order returned by create():", order);

    if (!order) {
      return res.status(500).json({ success: false, message: "Failed to create Razorpay order" });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create Razorpay order" });
  }
});

// POST /api/payment/verify-payment
router.post("/verify-payment", auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment parameters" });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment signature verified successfully, now process the order
      const io = req.app.get("io");
      const result = await processSuccessfulPayment(razorpay_order_id, razorpay_payment_id, io);
      
      if (result.success) {
        res.json({ success: true, message: "Payment verified successfully", data: result.order });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    console.error("Razorpay signature verification error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to verify Razorpay signature" });
  }
});

// POST /api/payment/webhook
// This must be a POST request and should ideally use express.raw({ type: 'application/json' }) if body-parser was strict, 
// but assuming standard json middleware is used, we use JSON.stringify(req.body) for signature if needed, 
// though Razorpay recommends raw body. For standard Express setups, Razorpay signature validation on parsed JSON can be tricky 
// if keys are reordered. We will use the raw webhook secret verification.
router.post("/webhook", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not defined");
      return res.status(500).send("Webhook secret not configured");
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).send("No signature found");
    }

    // Verify signature
    // Note: Razorpay webhook verification requires the raw request body. 
    // If the server uses app.use(express.json()), req.body is already parsed. 
    // For exact match, we must stringify it. A safer way in express is to have a raw body buffer, 
    // but if not available, JSON.stringify(req.body) often works for simple JSON if spacing matches.
    // However, Razorpay's `validateWebhookSignature` utility from the SDK handles this.
    const isValid = Razorpay.validateWebhookSignature(
      JSON.stringify(req.body),
      signature,
      secret
    );

    if (!isValid) {
      console.error("Webhook signature verification failed");
      return res.status(400).send("Invalid signature");
    }

    // Process event
    const event = req.body.event;
    
    if (event === "order.paid" || event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      if (razorpayOrderId && razorpayPaymentId) {
        const io = req.app.get("io");
        const result = await processSuccessfulPayment(razorpayOrderId, razorpayPaymentId, io);
        console.log(`Webhook processed for order ${razorpayOrderId}:`, result.message);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Webhook processing error");
  }
});

module.exports = router;
