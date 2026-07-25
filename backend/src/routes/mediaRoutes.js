const express = require("express");
const mediaController = require("../controllers/mediaController");

const router = express.Router();

router.get("/:key", mediaController.getMedia);

module.exports = router;
