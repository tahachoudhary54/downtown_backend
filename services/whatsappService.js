const twilio = require('twilio');
const Settings = require('../models/Settings');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Default Twilio Sandbox Number
    this.init();
  }

  init() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (accountSid && authToken && accountSid !== 'placeholder' && authToken !== 'placeholder') {
        this.client = twilio(accountSid, authToken);
        console.log('📱 WhatsApp Service initialized');
      } else {
        console.warn('⚠️ Twilio credentials missing. WhatsApp notifications will be simulated in console.');
      }
    } catch (err) {
      console.error('Failed to initialize WhatsApp service:', err.message);
    }
  }

  /**
   * Base method to send a WhatsApp message
   */
  async sendMessage(to, body) {
    if (!to) return { success: false, error: 'Recipient number missing' };
    
    // Format number to e.164 if not already (basic check)
    let formattedTo = to.trim();
    if (!formattedTo.startsWith('+')) {
      formattedTo = '+' + formattedTo;
    }
    const toWithPrefix = `whatsapp:${formattedTo}`;

    if (!this.client) {
      console.log('--- MOCK WHATSAPP MESSAGE ---');
      console.log(`To: ${toWithPrefix}`);
      console.log(`Body:\n${body}`);
      console.log('-----------------------------');
      return { success: true, simulated: true };
    }

    try {
      const message = await this.client.messages.create({
        body: body,
        from: this.fromNumber,
        to: toWithPrefix
      });
      console.log(`WhatsApp message sent to ${formattedTo}. SID: ${message.sid}`);
      return { success: true, sid: message.sid };
    } catch (error) {
      console.error(`WhatsApp Error sending to ${formattedTo}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send New Order Alert to Admin
   */
  async sendAdminOrderAlert(order) {
    try {
      const settings = await Settings.findOne();
      if (!settings || !settings.whatsapp || !settings.whatsapp.enabled || !settings.whatsapp.adminNumber) {
        return { success: false, reason: 'WhatsApp admin notifications disabled or number not set' };
      }

      // Build Message Body
      const itemsList = order.items.map(item => 
        `  • ${item.productName} × ${item.quantity} ${item.selectedSize ? `(Size: ${item.selectedSize})` : ''}`
      ).join('\n');

      const messageBody = `🛍️ *New Order Received!*\n━━━━━━━━━━━━━━━━━━━━\n*Order ID:* #${order._id.toString().slice(-6).toUpperCase()}\n*Customer:* ${order.customer.firstName} ${order.customer.lastName}\n*Phone:* ${order.customer.phone || 'N/A'}\n*Products:*\n${itemsList}\n*Total:* ₹${order.financials.total.toLocaleString('en-IN')}\n*Payment:* ${order.paymentMethod.type.toUpperCase()} ${order.paymentStatus === 'Completed' ? '✅ Paid' : '⏳ Pending'}\n\n[View Order in Admin Panel]`;

      return await this.sendMessage(settings.whatsapp.adminNumber, messageBody);
    } catch (error) {
      console.error('Error in sendAdminOrderAlert:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export a singleton instance
module.exports = new WhatsAppService();
