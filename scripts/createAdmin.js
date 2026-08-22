/**
 * Seeds/updates the admin user.
 *
 * Usage:  node scripts/createAdmin.js [email] [password]
 * Defaults to meromail123@gmail.com / 12345673
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../modals/userModal");

const EMAIL = (process.argv[2] || "meromail123@gmail.com").toLowerCase().trim();
const PASSWORD = process.argv[3] || "12345673";

(async () => {
  try {
    await mongoose.connect(process.env.DBHOST);
    console.log("MongoDB connected");

    const hashedPassword = await bcrypt.hash(PASSWORD, 10);

    const user = await User.findOneAndUpdate(
      { email: EMAIL },
      {
        $set: {
          email: EMAIL,
          password: hashedPassword,
          role: "ADMIN",
          status: "active"
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`✔ Admin ready: ${user.email} (role=${user.role}, status=${user.status})`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Failed to create admin:", err.message);
    process.exit(1);
  }
})();
