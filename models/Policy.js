const mongoose = require("mongoose");

const policySchema = new mongoose.Schema(
  {
    aboutUs: { type: String, default: "" },
    contactUs: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },
    privacyPolicy: { type: String, default: "" },
    shippingAndReturns: { type: String, default: "" },
    sizeGuide: { type: String, default: "" },
    faq: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Policy", policySchema);
