const jwt = require("jsonwebtoken");
const Message = require("../models/message");
const Conversation = require("../models/conversation");

const helpFeedbackChat = async (data, socket, io) => {
  try {
    const { token, conversation_id, message, msg_type } = data;

    console.log("Received help-feedback message:", data);
    // ✅ Validate input
    if (!token || !conversation_id || !message) {
      return socket.emit("error", "Missing required fields");
    }

    
    // ✅ Verify user
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.id;

    // ✅ Find conversation
    const conversation = await Conversation.findById(conversation_id);
    if (!conversation) {
      return socket.emit("error", "Conversation not found");
    }

    // ✅ Determine role
    const sender_role = decoded.role || 'user'; // "admin" or "user"
    const sender_model = sender_role === "admin" ? "Admin" : "User";

    const newMessage = await Message.create({
      conversation_id,
      sender: senderId,
      sender_model,
      sender_role,
      message,
      msg_type: msg_type || "text",
      status: "sent"
    });

    // ✅ Join room (important)
    socket.join(conversation_id.toString());


    console.log(message, "Message saved to DB with ID:", newMessage._id);
    console.log(sender_role, "Message saved to DB with ID:", newMessage._id);
    // ✅ Emit ONLY to this conversation
    io.to(conversation_id.toString()).emit("receive-message", {
      status: "ok",
      message: {
        sender_name: newMessage.sender_name || "You",
        sender_id: newMessage.sender,
        message: newMessage.message,
        sender_role: newMessage.sender_role,
        msg_type: newMessage.msg_type,
        timestamp: Date.now(), // <-- use createdAt from DB
      },
    });

    
    // ✅ Update conversation
    await Conversation.findByIdAndUpdate(conversation_id, {
      latest_msg: {
        text: message,
        sender: senderId,
        timestamp: Date.now()
      }
    });

  } catch (err) {
    console.error(err);
    socket.emit("error", "Something went wrong");
  }
};

module.exports = { helpFeedbackChat };