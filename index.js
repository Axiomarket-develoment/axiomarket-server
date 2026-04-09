require("dotenv").config();

const dns = require("dns");
const dnsPromises = require("node:dns/promises");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const passport = require("./confiq/passport"); // <-- Your Twitter strategy
const cron = require("node-cron");
const { createServer } = require("http");
const { HttpServer } = require("./websocket")


const Market = require("./models/Market"); 
const { startMarketCron } = require("./crons/marketCron");

// ---------------- DNS Config ----------------
// dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
// dns.setDefaultResultOrder("ipv4first");

// ---------------- Express Init ----------------

const app = express();
const httpServer = createServer(app);


HttpServer(httpServer);


const PORT = process.env.PORT || 7000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

// const store = MongoStore.create({ mongoUrl: "mongodb://127.0.0.1:27017/test" });
// console.log(store);

// ---------------- Middleware ----------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS for frontend + credentials (important for OAuth)
const allowedOrigins = ["http://localhost:3000","https://axiomarket-site.vercel.app","https://axiomarket.xyz"];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ---------------- Session ----------------
// MUST come before passport.initialize()
app.use(session({
  secret: process.env.SESSION_SECRET || "super_secret_key",
  resave: true,
  saveUninitialized: true,
  // store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  }
}));

// ---------------- Passport ----------------
app.use(passport.initialize());
app.use(passport.session());

// ---------------- MongoDB ----------------
mongoose.set("strictQuery", true);
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log("🟢 MongoDB connected successfully");
    startMarketCron();
  })
  .catch((err) => {
    console.error("❌ FULL Mongo Error:", err);
    process.exit(1);
  });

// ---------------- Routes ----------------
// Twitter OAuth
app.use("/user_auth", require("./routes/auth")); // Twitter login routes should be here

app.use("/user_market", require("./routes/markets"));
app.use("/user_chat", require("./routes/chat"));
// app.use("/user_trade", require("./routes/trade"));
app.use("/user_waitlist", require("./routes/waitlist"));
app.use("/user_history", require("./routes/history"));
app.use("/ai", require("./routes/ai"));

// Default route
app.get("/", (req, res) => {
  res.send("Server running!");
});

// ---------------- Start server ----------------
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with Socket.IO`);
});