const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");
const userController = require("../controllers/userController");

// protected route
router.get("/me", authMiddleware, userController.getMe);
router.put("/me", authMiddleware, userController.updateMe);
router.get("/me/following", authMiddleware, userController.getMyFollowing);
router.get("/me/followers", authMiddleware, userController.getMyFollowers);
router.get("/:id/status", authMiddleware, userController.getUserStatus);
router.get("/:id/following", userController.getFollowing);
router.get("/:id/followers", userController.getFollowers);
router.get("/:id", optionalAuthMiddleware, userController.getUser);

module.exports = router;
