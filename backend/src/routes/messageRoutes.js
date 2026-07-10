const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const messageController = require("../controllers/messageController");

const router = express.Router();

router.get("/chats", authMiddleware, messageController.getChats);
router.get("/stream", authMiddleware, messageController.streamMessages);
router.get("/:userId", authMiddleware, messageController.getConversation);
router.post("/:userId", authMiddleware, messageController.sendMessage);

module.exports = router;
