const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authMiddleware = require("../middleware/authMiddleware");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");
// protected
router.post("/", authMiddleware, postController.createPost);
router.post("/images", authMiddleware, postController.createImages);
router.post("/videos", authMiddleware, postController.createVideo);
router.put("/:id", authMiddleware, postController.updatePost);
router.delete("/:id", authMiddleware, postController.deletePost);
router.post("/:id/pin", authMiddleware, postController.pinPost);
router.post("/:id/purchase", authMiddleware, postController.purchasePost);
router.get("/:id/reactions/users", authMiddleware, postController.getReactionUsers);
// public
router.get("/tags", optionalAuthMiddleware, postController.listTags);
router.get("/images", optionalAuthMiddleware, postController.listImages);
router.get("/", optionalAuthMiddleware, postController.listPosts);
router.get("/:id", optionalAuthMiddleware, postController.getPost);
module.exports = router;
