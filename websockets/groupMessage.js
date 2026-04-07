const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Conversation = require("../models/conversation");
const User = require("../models/User");

const groupChatMessage = async (data, socket, io, callback) => {
  try {
    const { token, conversation_id, message, msg_type } = data;

    if (!token || !conversation_id || !message) {
      return socket.emit("receive-error-message", "Missing required fields");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.id;

    const user = await User.findById(senderId).select("username");
    const sender_name = user?.username || "User";

    const conversation = await Conversation.findById(conversation_id);
    if (!conversation) {
      return socket.emit("receive-error-message", "Conversation not found");
    }

    const newMessage = await Message.create({
      conversation_id,
      sender: senderId,
      sender_name,
      message,
      msg_type: msg_type || "text",
    });

    socket.join(conversation_id.toString());

    const payload = {
      status: "ok",
      message: {
        sender_name,
        sender_id: senderId,
        message: newMessage.message,
        msg_type: newMessage.msg_type,
        timestamp: newMessage.createdAt.getTime(),
      },
    };

    io.to(conversation_id.toString()).emit("receive-message", payload);

    await Conversation.findByIdAndUpdate(conversation_id, {
      latest_msg: {
        text: message,
        sender: senderId,
        timestamp: Date.now(),
      },
    });

    // ✅ THIS FIXES YOUR ISSUE
    if (callback) {
      callback({ status: "ok" });
    }

  } catch (err) {
    console.error("Group chat error:", err);

    if (callback) {
      callback({ status: "error", msg: "Something went wrong" });
    }

    socket.emit("receive-error-message", "Something went wrong");
  }
};

module.exports = { groupChatMessage };