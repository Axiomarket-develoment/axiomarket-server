// routes/user_chat.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Conversation = require("../models/conversation");
const User = require("../models/User"); // adjust if your user model name is different
const Message = require("../models/Message");

// POST /user_chat/get_messages
router.post("/get_messages", async (req, res) => {
  try {
    const { token, conversationId } = req.body;

    if (!token || !conversationId) {
      return res.status(400).json({ success: false, msg: "Missing token or conversationId" });
    }

    // Verify user
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ success: false, msg: "User not found" });

    // Check if conversation exists
    const conversation = await Conversation.findById(conversationId).populate("participants", "fullname");
    if (!conversation) return res.status(404).json({ success: false, msg: "Conversation not found" });

    // Fetch all messages in this conversation
    const messages = await Message.find({ conversation_id: conversationId })
      .sort({ createdAt: 1 }) // oldest first
      .populate("sender", "fullname");

    // Map messages to a clean format for frontend
    const mappedMessages = messages.map((m) => ({
      sender_name: m.sender_name || "Unknown",
      sender_id: m.sender?._id || m.sender,
      message: m.message,
      timestamp: m.createdAt.getTime(),
      msg_type: m.msg_type,
      file_url: m.file_url || null,
    }));

    return res.json({ success: true, data: mappedMessages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

module.exports = router;