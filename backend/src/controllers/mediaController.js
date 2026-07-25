const minioStorageService = require("../services/minioStorageService");

async function getMedia(req, res) {
    try {
        const key = decodeURIComponent(req.params.key);
        const stat = await minioStorageService.statObject(key);
        const stream = await minioStorageService.getObjectStream(key);

        res.setHeader("Content-Type", stat.metaData?.["content-type"] || "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        stream.pipe(res);
    } catch (err) {
        res.status(404).json({ error: err.message || "Media not found" });
    }
}

module.exports = {
    getMedia
};
