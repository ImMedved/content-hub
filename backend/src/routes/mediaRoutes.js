const express = require("express");
const mediaController = require("../controllers/mediaController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/:mediaId/playback-session", authMiddleware, mediaController.createPlaybackSession);
router.get(/^\/playback\/([^/]+)\/(.+)$/, mediaController.getPlaybackObject);
router.get("/:key", mediaController.getMedia);

module.exports = router;
