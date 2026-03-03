require("dotenv").config();

const dns = require("dns");
const dnsPromises = require("node:dns/promises");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");
const Market = require("./models/Market"); // ✅ IMPORT MODEL
const { startMarketCron } = require("./crons/marketCron");

dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());




// MongoDB connection
mongoose.set("strictQuery", true);

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log("🟢 MongoDB connected");

    // ✅ START CRON AFTER DB CONNECTS
    startMarketCron();

    // Routes
    app.use("/user_market", require("./routes/markets"));
    app.use("/user_trade", require("./routes/trade"));
    app.use("/user_waitlist", require("./routes/waitlist"));

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });