const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { groupChatMessage } = require("./websockets/groupMessage");

let io;

const HttpServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000",
        "https://axiomarket-site.vercel.app",
        "https://axiomarket.xyz",
      ],
      credentials: true,
    },

    // ✅ CRITICAL FOR RENDER / PROXY / FREE TIER STABILITY
    transports: ["polling", "websocket"],
    allowEIO3: true,

    pingTimeout: 60000,
    pingInterval: 25000,

    // prevents random disconnect spikes on Render
    connectTimeout: 45000,
  });

  // =========================
  // AUTH MIDDLEWARE (SAFE VERSION)
  // =========================
  io.use((socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie;

      if (!cookie) {
        // ⚠️ don't hard fail socket on render (optional safe fallback)
        socket.user = null;
        return next();
      }

      const parsed = Object.fromEntries(
        cookie.split("; ").map((c) => c.split("="))
      );

      const token = parsed.token;

      if (!token) {
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;

      next();
    } catch (err) {
      // ⚠️ IMPORTANT: do NOT kill connection on handshake failure in prod
      console.log("Socket auth error:", err.message);
      socket.user = null;
      next();
    }
  });

  // =========================
  // CONNECTION
  // =========================
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // JOIN USER ROOM
    socket.on("auth", (userId) => {
      if (!userId) return;

      const id = userId.toString();
      socket.join(id);
      socket.userId = id;

      console.log("User joined personal room:", id);
    });

    // JOIN CHAT ROOM
    socket.on("join-room", (conversation_id) => {
      if (!conversation_id) return;

      socket.join(conversation_id);
      console.log("User joined room:", conversation_id);
    });

    // GROUP MESSAGE
    socket.on("group-message", (data, callback) => {
      groupChatMessage(data, socket, io, callback);
    });

    // TYPING
    socket.on("typing", ({ conversation_id, sender_name }) => {
      socket.to(conversation_id).emit("user-typing", {
        sender_name,
      });
    });

    socket.on("stop-typing", ({ conversation_id, sender_name }) => {
      socket.to(conversation_id).emit("user-stop-typing", {
        sender_name,
      });
    });

    // DISCONNECT
    socket.on("disconnect", (reason) => {
      console.log("User disconnected:", socket.id, reason);
    });
  });

  console.log("✅ Socket.IO initialized");
};

const getIO = () => io;

module.exports = { HttpServer, getIO };