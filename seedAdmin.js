const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const User = require("./models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const adminEmail = process.env.ADMIN_EMAIL || "ahmarmalik4928@gmail.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123"; // Should be changed in production

    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      console.log("Admin user already exists.");
      adminUser.role = "admin";
      adminUser.isVerified = true;
      await adminUser.save();
      console.log("Existing user role updated to admin.");
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      adminUser = new User({
        name: "Admin",
        email: adminEmail,
        password: hashedPassword,
        isVerified: true,
        role: "admin",
      });

      await adminUser.save();
      console.log(`Admin user created: ${adminEmail}`);
      console.log(`Please change the default password after logging in.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
