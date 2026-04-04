const { Server } = require("socket.io");
const { helpFeedbackChat } = require("./websockets/help_feedback");

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
    socket.on('help-feedback', message => {
      helpFeedbackChat(message, socket, io);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = { HttpServer };
