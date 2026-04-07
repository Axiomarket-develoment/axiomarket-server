const { Server } = require("socket.io");
const { groupChatMessage } = require("./websockets/groupMessage");

let io;

const HttpServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    // socket for help and feedback

    socket.on("join-room", (conversation_id) => {
      socket.join(conversation_id);
      console.log("User joined room:", conversation_id);
    });


    socket.on("group-message", (data, callback) => {
      groupChatMessage(data, socket, io, callback);
    });


    socket.on("typing", ({ conversation_id, sender_name }) => {
      socket.to(conversation_id).emit("user-typing", {
        sender_name,
      });
    });

    socket.on("stop-typing", ({ conversation_id, sender_name }) => {
      socket.to(conversation_id).emit("user-stop-typing", { sender_name });
    });


    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = { HttpServer };
