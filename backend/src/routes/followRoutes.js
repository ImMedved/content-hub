const express = require("express");
const router = express.Router();

const followController = require("../controllers/followController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/:userId", authMiddleware, followController.follow);
router.delete("/:userId", authMiddleware, followController.unfollow);

module.exports = router;