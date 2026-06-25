require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seedAdmin() {
  const adminEmail = process.argv[2];
  const adminPassword = process.argv[3];

  if (!adminEmail || !adminPassword) {
    console.error("❌ Please provide email and password as arguments.");
    console.error("Usage: node scripts/seedAdmin.js <email> <password>");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if an admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("ℹ️ Admin account already exists. Skipping creation.");
      return;
    }

    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      console.log(`ℹ️ User with email ${adminEmail} already exists. Updating role to admin.`);
      existingUser.role = "admin";
      await existingUser.save();
      console.log("✅ Admin role granted successfully.");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const adminUser = new User({
      name: "Admin User",
      email: adminEmail,
      password: hashedPassword,
      isVerified: true,
      role: "admin",
    });

    await adminUser.save();
    console.log(`✅ Admin account created successfully! Email: ${adminEmail}`);
  } catch (err) {
    console.error("❌ Error seeding admin:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

seedAdmin();
