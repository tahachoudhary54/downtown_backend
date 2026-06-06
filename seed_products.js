require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

const products = [
  {
    name: "Modern Oversized Baggy Shirt",
    price: "$55.00",
    priceValue: 55,
    img: "/cat_baggy_shirt.png",
    description: "A premium oversized baggy shirt designed for a relaxed and modern look.",
    category: "Baggy Shirt"
  },
  {
    name: "Classic Regular Fit Shirt",
    price: "$45.00",
    priceValue: 45,
    img: "/cat_regular_shirt.png",
    description: "A timeless regular-fit shirt made from high-quality cotton for everyday elegance.",
    category: "Regular Shirt"
  },
  {
    name: "Premium Linen Summer Shirt",
    price: "$65.00",
    priceValue: 65,
    img: "/cat_linen_shirt.png",
    description: "Breathable and stylish premium linen shirt, perfect for warm weather.",
    category: "Linen Shirt"
  },
  {
    name: "Casual Short Sleeve Shirt",
    price: "$40.00",
    priceValue: 40,
    img: "/cat_half_sleeve_shirt.png",
    description: "Comfortable and casual short-sleeve shirt for a laid-back weekend style.",
    category: "Half Sleeve Shirt"
  },
  {
    name: "Essential Basic T-Shirt",
    price: "$25.00",
    priceValue: 25,
    img: "/cat_t_shirt.png",
    description: "A premium basic t-shirt featuring a tailored fit and ultra-soft fabric.",
    category: "T-Shirt"
  },
  {
    name: "Classic Polo T-Shirt",
    price: "$35.00",
    priceValue: 35,
    img: "/cat_polo_t_shirt.png",
    description: "A stylish and versatile polo t-shirt for a smart-casual wardrobe.",
    category: "Polo T-Shirt"
  },
  {
    name: "Long Sleeve Layering T-Shirt",
    price: "$30.00",
    priceValue: 30,
    img: "/cat_full_sleeve_t_shirt.png",
    description: "A comfortable long-sleeve t-shirt, perfect for layering or wearing on its own.",
    category: "Full Sleeve T-Shirt"
  },
  {
    name: "Modern Track Pant",
    price: "$50.00",
    priceValue: 50,
    img: "/cat_track_pant.png",
    description: "Athleisure track pants offering superior comfort and a contemporary fit.",
    category: "Track Pant"
  },
  {
    name: "Loose Fit Baggy Jeans",
    price: "$70.00",
    priceValue: 70,
    img: "/cat_baggy_jeans.png",
    description: "Trendy loose-fit baggy denim jeans for the ultimate street style.",
    category: "Baggy Jeans"
  },
  {
    name: "Vintage Boot Cut Jeans",
    price: "$75.00",
    priceValue: 75,
    img: "/cat_boot_cut_jeans.png",
    description: "Classic boot-cut denim jeans with a flattering fit and premium wash.",
    category: "Boot Cut Jeans"
  },
  {
    name: "Everyday Regular Fit Jeans",
    price: "$60.00",
    priceValue: 60,
    img: "/cat_regular_fit_jeans.png",
    description: "Durable and comfortable regular-fit denim jeans for everyday wear.",
    category: "Regular Fit Jeans"
  },
  {
    name: "Classic Straight Fit Jeans",
    price: "$65.00",
    priceValue: 65,
    img: "/cat_straight_fit_jeans.png",
    description: "Timeless straight-fit denim jeans that pair perfectly with any top.",
    category: "Straight Fit Jeans"
  }
];

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    await Product.deleteMany({});
    console.log("Cleared existing products");
    await Product.insertMany(products);
    console.log("Inserted new products");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
