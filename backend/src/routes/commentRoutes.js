const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const authMiddleware = require("../middleware/authMiddleware");
router.post("/", authMiddleware, commentController.createComment);
router.get("/post/:postId", commentController.getComments);
router.delete("/:id", authMiddleware, commentController.deleteComment);
module.exports = router;
