require("dotenv").config();

const dns = require("dns");
const dnsPromises = require("node:dns/promises");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { createServer } = require("http");
const { HttpServer } = require("./websocket");

const Market = require("./models/Market");
const Ambassador = require("./models/Ambassador");
const User = require("./models/User");

const { startOracle } = require("./services/price/priceOracle");
const { startEngine } = require("./crons/mastercron");



// ---------------- DNS Config ----------------
// dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
// dns.setDefaultResultOrder("ipv4first");

// ---------------- Express Init ----------------
const app = express();

app.set("trust proxy", 1);

const httpServer = createServer(app);

HttpServer(httpServer);

// ---------------- ENV ----------------
const PORT = process.env.PORT || 7000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

app.use(cookieParser());
// ---------------- Middleware ----------------
app.use(express.json({ limit: "50mb" }));

app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
  })
);


// ---------------- CORS ----------------
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:3000",
        "https://axiomarket-site.vercel.app",
        "https://axiomarket.xyz",
      ];

      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ---------------- MongoDB ----------------
mongoose.set("strictQuery", true);

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("🟢 MongoDB connected successfully");

    // 🔥 Start price oracle
    await startOracle();

    console.log("🟢 Oracle initialized");

    // await deleteEmptyMarketsOnBoot()

    // 🔥 Start master engine
    startEngine();

    console.log("🟢 Engine started");
  })
  .catch((err) => {
    console.error("❌ Mongo Error:", err);
    process.exit(1);
  });

// ---------------- Cleanup Functions ----------------

async function deleteAllLiveMarketsOnBoot() {
  const { adminDb } = require("./lib/firebaseAdmin");

  try {
    console.log("🧨 Boot cleanup: deleting LIVE markets...");

    const liveMarkets = await Market.find({
      status: "LIVE",
    });

    console.log(`Found ${liveMarkets.length} LIVE markets`);

    for (const market of liveMarkets) {
      const id = market._id.toString();

      await Market.findByIdAndDelete(id);

      try {
        await adminDb
          .collection("markets")
          .doc(id)
          .delete();
      } catch (e) {
        console.log(
          "⚠️ Firestore delete skipped:",
          e.message
        );
      }

      console.log(`🗑 deleted: ${id}`);
    }

    console.log("✅ Boot cleanup complete");
  } catch (err) {
    console.error(
      "❌ Boot delete failed:",
      err.message
    );
  }
}

async function deleteAllLiveCryptoMarketsOnBoot() {
  const { adminDb } = require("./lib/firebaseAdmin");

  try {
    console.log(
      "🧨 Boot cleanup: deleting LIVE CRYPTO markets..."
    );

    const liveMarkets = await Market.find({
      status: "LIVE",
      marketType: "CRYPTO",
    }).select("_id");

    console.log(
      `Found ${liveMarkets.length} LIVE CRYPTO markets`
    );

    if (liveMarkets.length === 0) {
      console.log(
        "✅ No LIVE CRYPTO markets to delete"
      );
      return;
    }

    const ids = liveMarkets.map((m) =>
      m._id.toString()
    );

    // Mongo bulk delete
    await Market.deleteMany({
      _id: { $in: ids },
      marketType: "CRYPTO",
    });

    // Firestore cleanup
    await Promise.all(
      ids.map((id) =>
        adminDb
          .collection("markets")
          .doc(id)
          .delete()
          .catch((e) => {
            console.log(
              `⚠️ Firestore skip ${id}:`,
              e.message
            );
          })
      )
    );

    console.log(
      `🗑 Deleted ${ids.length} LIVE CRYPTO markets`
    );

    console.log("✅ Boot cleanup complete");
  } catch (err) {
    console.error(
      "❌ Boot delete failed:",
      err.message
    );
  }
}

async function deleteAmbassadorsWithoutUsers() {
  try {
    console.log(
      "🧹 Starting ambassador cleanup..."
    );

    const ambassadors = await Ambassador.find();

    let deletedCount = 0;
    let keptCount = 0;

    for (const amb of ambassadors) {
      if (!amb.email) {
        await Ambassador.deleteOne({
          _id: amb._id,
        });

        deletedCount++;
        continue;
      }

      const userExists = await User.findOne({
        email: amb.email,
      });

      if (!userExists) {
        await Ambassador.deleteOne({
          _id: amb._id,
        });

        deletedCount++;

        console.log(
          `❌ Deleted ambassador: ${amb.email}`
        );
      } else {
        keptCount++;
      }
    }

    console.log("✅ Cleanup finished");
    console.log(`✔ Kept: ${keptCount}`);
    console.log(`🗑 Deleted: ${deletedCount}`);
  } catch (err) {
    console.error(
      "❌ Cleanup error:",
      err.message
    );
  }
}

async function deleteEmptyMarketsOnBoot() {
  try {
    console.log("🧹 Cleaning empty markets...");

    const result = await Market.deleteMany({
      tradeCount: 0,
      totalVolume: 0,
    });

    console.log(
      `🗑 Deleted ${result.deletedCount} empty markets`
    );

    console.log(
      "✅ Empty market cleanup complete"
    );
  } catch (err) {
    console.error(
      "❌ Empty market cleanup failed:",
      err.message
    );
  }
}

// ---------------- Routes ----------------
app.use("/user_auth", require("./routes/auth"));

app.use("/user_market", require("./routes/markets"));

app.use("/user_chat", require("./routes/chat"));

app.use("/user_waitlist", require("./routes/waitlist"));

app.use("/user_history", require("./routes/history"));

app.use("/ai", require("./routes/ai"));

app.use("/user_ambassador", require("./routes/ambassador"));

app.use("/user_kol", require("./routes/kol"));

app.use("/user_match", require("./routes/match"));

app.use("/user_player", require("./routes/player"));


app.use("/admin_auth", require("./routes/admin/auth"))
app.use("/admin_market", require("./routes/admin/market"))

// ---------------- Default Route ----------------
app.get("/", (req, res) => {
  res.send("Server running!");
});

app.get("/test-cookie", (req, res) => {
  res.cookie("test_token", "123456", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  res.json({
    success: true,
    message: "Cookie set",
  });
});

app.get("/debug-cookie", (req, res) => {
  res.json({
    cookies: req.cookies,
    hasToken: !!req.cookies.token
  });
});





// ---------------- Start Server ----------------
httpServer.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT} with Socket.IO`
  );
});