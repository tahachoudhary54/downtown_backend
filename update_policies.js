const fs = require('fs');

const policies = {
  faq: JSON.stringify([
    {
      category: "Orders",
      items: [
        { question: "How can I track my order?", answer: "Once your order has shipped, you will receive an email with your tracking number. You can also view your order status by logging into your account." },
        { question: "Can I modify or cancel my order?", answer: "We process orders quickly, but if you contact us within 1 hour of placing your order, we may be able to modify or cancel it. Please reach out to our support team immediately." }
      ]
    },
    {
      category: "Shipping",
      items: [
        { question: "What are your shipping rates?", answer: "We offer complimentary standard shipping on all orders over $200. For orders under $200, a flat rate of $15 applies. Express shipping is available for $25." },
        { question: "Do you ship internationally?", answer: "Yes, we ship to select international destinations. International shipping rates and delivery times vary by location and will be calculated at checkout." }
      ]
    },
    {
      category: "Returns",
      items: [
        { question: "What is your return policy?", answer: "We accept returns on unworn, unwashed items with tags attached within 30 days of delivery. Custom or personalized items are final sale." },
        { question: "How do I process a return?", answer: "To initiate a return, log into your account and navigate to 'My Orders', or contact our support team. A return shipping label will be provided." }
      ]
    },
    {
      category: "Payments",
      items: [
        { question: "What payment methods do you accept?", answer: "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and Apple Pay." },
        { question: "Is my payment information secure?", answer: "Yes, we use industry-standard encryption protocols to ensure your payment information is kept secure and confidential." }
      ]
    }
  ], null, 2),

  sizeGuide: JSON.stringify({
    heroTitle: "Find Your Perfect Fit",
    heroSubtitle: "Detailed measurements and fit guidance to ensure your selections are perfectly tailored to you.",
    tableHeaders: ["Size", "Chest (in)", "Waist (in)", "Sleeve (in)", "Neck (in)"],
    tableRows: [
      ["XS", "34-36", "28-30", "32.5", "14-14.5"],
      ["S", "38-40", "32-34", "33.5", "15-15.5"],
      ["M", "42-44", "36-38", "34.5", "16-16.5"],
      ["L", "46-48", "40-42", "35.5", "17-17.5"],
      ["XL", "50-52", "44-46", "36.5", "18-18.5"],
      ["XXL", "54-56", "48-50", "37.5", "19-19.5"]
    ],
    fitCards: [
      { title: "Slim Fit", desc: "Tailored close to the body for a sharp, modern silhouette. Ideal for a refined look." },
      { title: "Regular Fit", desc: "A classic, comfortable cut with moderate room through the chest and waist." },
      { title: "Relaxed Fit", desc: "Generously cut for ease of movement and a more casual, laid-back aesthetic." }
    ],
    measurementSteps: [
      { title: "Chest", desc: "Measure under your arms, around the fullest part of your chest." },
      { title: "Waist", desc: "Measure around your natural waistline, keeping the tape comfortably loose." },
      { title: "Sleeve", desc: "Start at the center back of your neck, measure across the shoulder to your wrist." }
    ],
    expertTip: "If you are between sizes for a tailored garment, we recommend selecting the larger size and consulting a tailor for the perfect finish."
  }, null, 2),

  shippingAndReturns: JSON.stringify({
    heroTitle: "Shipping & Returns",
    heroSubtitle: "Enjoy a seamless luxury shopping experience from checkout to delivery.",
    timeline: [
      { title: "Order Placed", desc: "You'll receive a confirmation email instantly.", iconPath: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" },
      { title: "Packed", desc: "Carefully hand-packed within 24 hours.", iconPath: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" },
      { title: "Shipped", desc: "Dispatched with our premium logistics partners.", iconPath: "M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
      { title: "Delivered", desc: "Arrives safely at your doorstep.", iconPath: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" }
    ],
    cards: [
      {
        title: "Shipping Information",
        items: [
          "**Standard Delivery:** 3-5 business days. Complimentary on all orders over $200.",
          "**Express Delivery:** 1-2 business days. Available for a flat rate of $25.",
          "**International Delivery:** 5-10 business days depending on location. Duties may apply."
        ],
        note: "Please note that orders placed after 2 PM EST will be processed the following business day."
      },
      {
        title: "Returns Policy",
        items: [
          "Items must be returned within 30 days of delivery.",
          "All garments must remain unworn, unwashed, and with all original Downtown Boutique tags attached.",
          "Footwear must be returned in its original, undamaged shoebox.",
          "Customized, tailored, or final sale items cannot be returned."
        ],
        note: "A prepaid return shipping label is included with all domestic orders."
      },
      {
        title: "Refund Process",
        paragraphs: [
          "Once your return is received and inspected at our facility, we will send you an email to notify you of the approval or rejection of your refund.",
          "Approved refunds will be processed immediately, and a credit will automatically be applied to your original method of payment within 5-7 business days, depending on your financial institution."
        ]
      }
    ]
  }, null, 2),

  aboutUs: JSON.stringify({
    heroTitle: "Our Story",
    heroSubtitle: "Redefining modern menswear with timeless elegance and uncompromising quality.",
    sections: [
      {
        title: "The Heritage",
        paragraphs: [
          "Founded with a vision to bring unparalleled luxury to the modern gentleman, Downtown Boutique has established itself as the premier destination for discerning individuals. We believe that true style is a reflection of character, and our collections are curated to enhance the unique presence of every client.",
          "From our humble beginnings to our current flagship presence, our dedication to excellence has remained unwavering. Every garment we select represents the pinnacle of design and sartorial mastery."
        ],
        icon: "✨",
        iconText: "Heritage & Tradition"
      },
      {
        title: "Uncompromising Quality",
        paragraphs: [
          "Our commitment to quality begins long before a garment reaches our shelves. We partner exclusively with artisans and ateliers who share our passion for perfection. Each piece is crafted using the finest materials sourced from historic mills around the globe.",
          "We pay meticulous attention to the smallest details—from the strength of the stitching to the precision of the cut—ensuring that your investment stands the test of time both in durability and style."
        ],
        icon: "✂️",
        iconText: "Masterful Craftsmanship"
      }
    ],
    stats: [
      { number: "10k+", label: "Happy Customers" },
      { number: "500+", label: "Premium Products" },
      { number: "24/7", label: "Dedicated Support" },
      { number: "100%", label: "Secure Payments" }
    ]
  }, null, 2),

  contactUs: JSON.stringify({
    heroTitle: "Contact Us",
    heroSubtitle: "We're here to assist you with any inquiries regarding our collections, your orders, or styling advice.",
    clientServicesTitle: "Client Services",
    clientServicesDesc: "Our dedicated team of advisors is available to provide personalized assistance.",
    email: "support@downtownboutique.com",
    phone: "+1 (800) 123-4567",
    businessHours: [
      "Monday - Friday: 9am - 8pm EST",
      "Saturday: 10am - 6pm EST"
    ],
    whatsappLink: "https://wa.me/919867211505",
    whatsappText: "Instant support from our styling team"
  }, null, 2),

  termsAndConditions: JSON.stringify({
    lastUpdated: "October 15, 2023",
    sections: [
      {
        id: "introduction",
        title: "1. Introduction",
        paragraphs: ["Welcome to Downtown Boutique. These Terms and Conditions govern your use of our website and services. By accessing or using our platform, you agree to be bound by these terms. If you do not agree with any part of these terms, you may not use our services."]
      },
      {
        id: "use-of-site",
        title: "2. Use of Site",
        paragraphs: ["You may use our site for lawful purposes only. You must not use our site in any way that causes, or may cause, damage to the site or impairment of the availability or accessibility of the site."],
        listItems: [
          "You must be at least 18 years of age to use this site.",
          "You must ensure that all information you supply to us is true, accurate, current, and complete."
        ]
      },
      {
        id: "intellectual-property",
        title: "3. Intellectual Property",
        paragraphs: ["All content included on this site, such as text, graphics, logos, images, audio clips, digital downloads, and data compilations, is the property of Downtown Boutique or its content suppliers and is protected by international copyright laws."]
      },
      {
        id: "products-pricing",
        title: "4. Products & Pricing",
        paragraphs: [
          "We strive to display our products and their colors as accurately as possible. However, the actual colors you see will depend on your monitor. All prices are subject to change without notice.",
          "In the event a product is listed at an incorrect price due to a typographical error, Downtown Boutique shall have the right to refuse or cancel any orders placed for products listed at the incorrect price."
        ]
      },
      {
        id: "orders",
        title: "5. Orders & Acceptance",
        paragraphs: ["Your receipt of an electronic or other form of order confirmation does not signify our acceptance of your order, nor does it constitute confirmation of our offer to sell. Downtown Boutique reserves the right at any time after receipt of your order to accept or decline your order for any reason."]
      },
      {
        id: "limitation-liability",
        title: "6. Limitation of Liability",
        paragraphs: ["In no event shall Downtown Boutique or its directors, employees, or affiliates be liable for any direct, indirect, incidental, special, or consequential damages arising out of or in any way connected with the use of our site or products."]
      }
    ]
  }, null, 2),

  privacyPolicy: JSON.stringify({
    lastUpdated: "October 15, 2023",
    sections: [
      {
        id: "data-collection",
        title: "1. Data Collection",
        paragraphs: ["We collect information that you provide directly to us when you create an account, make a purchase, or communicate with us. This may include your name, email address, shipping address, billing address, and payment information."]
      },
      {
        id: "use-of-data",
        title: "2. Use of Your Data",
        paragraphs: ["We use the information we collect to provide, maintain, and improve our services. Specifically, we use your data to:"],
        listItems: [
          "Process your transactions and send you related information, including order confirmations and receipts.",
          "Send you technical notices, updates, security alerts, and support messages.",
          "Respond to your comments, questions, and customer service requests.",
          "Communicate with you about products, services, offers, and events offered by Downtown Boutique."
        ]
      },
      {
        id: "data-sharing",
        title: "3. Data Sharing",
        paragraphs: ["We do not share your personal information with third parties except as described in this privacy policy. We may share your information with vendors, consultants, and other service providers who need access to such information to carry out work on our behalf."]
      },
      {
        id: "cookies",
        title: "4. Cookies & Tracking",
        paragraphs: ["We use cookies and similar tracking technologies to track the activity on our Service and hold certain information. Cookies are files with small amount of data which may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent."]
      },
      {
        id: "security",
        title: "5. Security",
        paragraphs: ["The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security."]
      },
      {
        id: "your-rights",
        title: "6. Your Rights",
        paragraphs: ["You have the right to access, update, or delete the information we have on you. Whenever made possible, you can access, update, or request deletion of your Personal Data directly within your account settings section. If you are unable to perform these actions yourself, please contact us to assist you."]
      }
    ]
  }, null, 2)
};

async function updatePolicies() {
  try {
    const mongoose = require('mongoose');
    require('dotenv').config({ path: __dirname + '/.env' });
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const db = mongoose.connection.db;
    
    // Check if policies exist
    const policyDoc = await db.collection('policies').findOne({});
    if (policyDoc) {
      await db.collection('policies').updateOne({}, { $set: policies });
      console.log('Policies updated in DB!');
    } else {
      await db.collection('policies').insertOne(policies);
      console.log('Policies inserted into DB!');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error updating policies:', err);
    process.exit(1);
  }
}

updatePolicies();
