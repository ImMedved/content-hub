const express = require("express");
const router = express.Router();

const reactionController = require("../controllers/reactionController");
const authMiddleware = require("../middleware/authMiddleware");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");

router.post("/", authMiddleware, reactionController.addReaction);
router.delete("/:postId", authMiddleware, reactionController.removeReaction);
router.get("/:postId", optionalAuthMiddleware, reactionController.getReactions);

module.exports = router;
