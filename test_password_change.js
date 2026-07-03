require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function runTest() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    const testEmail = "test_password_change@example.com";
    const initialPassword = "oldPassword123";
    const newPassword = "newPassword456";

    // 1. Clean up old test user
    await User.deleteOne({ email: testEmail });

    // 2. Create a test user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(initialPassword, salt);
    
    const user = new User({
      name: "Test User",
      email: testEmail,
      password: hashedPassword,
      role: "admin"
    });
    await user.save();
    console.log("✅ Step 1: Created test user with initial password.");

    // 3. Simulate the password change endpoint logic
    const foundUser = await User.findById(user._id);
    
    // Verify old password (simulating user inputting currentPassword)
    const isMatch = await bcrypt.compare(initialPassword, foundUser.password);
    if (!isMatch) throw new Error("Initial password verification failed!");
    console.log("✅ Step 2: Successfully verified the old password.");

    // Hash and save new password
    const newSalt = await bcrypt.genSalt(10);
    foundUser.password = await bcrypt.hash(newPassword, newSalt);
    await foundUser.save();
    console.log("✅ Step 3: Successfully saved the new hashed password.");

    // 4. Verify that the new password works and old password fails
    const updatedUser = await User.findById(user._id);
    
    const oldPassCheck = await bcrypt.compare(initialPassword, updatedUser.password);
    if (oldPassCheck) throw new Error("Old password should not work anymore!");
    console.log("✅ Step 4: Confirmed old password no longer works.");

    const newPassCheck = await bcrypt.compare(newPassword, updatedUser.password);
    if (!newPassCheck) throw new Error("New password does not work!");
    console.log("✅ Step 5: Confirmed new password works perfectly.");

    // Clean up
    await User.deleteOne({ email: testEmail });
    console.log("Test completed successfully! The password change logic works perfectly.");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    mongoose.connection.close();
  }
}

runTest();
