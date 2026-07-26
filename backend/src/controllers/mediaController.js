const minioStorageService = require("../services/minioStorageService");
const mediaPlaybackService = require("../services/mediaPlaybackService");

function getContentType(key, fallback) {
    const normalizedKey = String(key || "").toLowerCase();

    if (normalizedKey.endsWith(".m3u8")) {
        return "application/vnd.apple.mpegurl";
    }

    if (normalizedKey.endsWith(".m4s")) {
        return "video/iso.segment";
    }

    if (normalizedKey.endsWith(".mp4")) {
        return "video/mp4";
    }

    if (normalizedKey.endsWith(".jpg") || normalizedKey.endsWith(".jpeg")) {
        return "image/jpeg";
    }

    return fallback || "application/octet-stream";
}

function isSafeRelativePath(value) {
    const normalized = String(value || "").replace(/\\/g, "/");
    return normalized && !normalized.startsWith("/") && !normalized.split("/").includes("..");
}

function normalizePlaybackPath(value) {
    const normalized = String(value || "").replace(/\\/g, "/");

    if (normalized.startsWith("master/video/")) {
        return normalized.slice("master/".length);
    }

    return normalized;
}

function setMediaHeaders(res, key, fallbackContentType) {
    res.setHeader("Content-Type", getContentType(key, fallbackContentType));

    if (String(key || "").toLowerCase().endsWith(".m3u8")) {
        res.setHeader("Cache-Control", "private, max-age=30");
        return;
    }

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
}

async function getMedia(req, res) {
    try {
        const key = decodeURIComponent(req.params.key);
        const stat = await minioStorageService.statObject(key);
        const stream = await minioStorageService.getObjectStream(key);

        setMediaHeaders(res, key, stat.metaData?.["content-type"]);
        stream.pipe(res);
    } catch (err) {
        res.status(404).json({ error: err.message || "Media not found" });
    }
}

async function createPlaybackSession(req, res) {
    try {
        const result = await mediaPlaybackService.createPlaybackSession(
            req.params.mediaId,
            req.user.userId
        );

        if (result.cookie) {
            res.cookie(result.cookie.name, result.cookie.value, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/api/v1/media/playback/",
                maxAge: result.cookie.maxAge * 1000
            });
        }

        res.json({ data: result.payload || result, error: null });
    } catch (err) {
        const status = /access/i.test(err.message) ? 403 : 404;
        console.error(`[media-controller] playback session failed mediaId=${req.params.mediaId} status=${status} error=${err.message}`);
        res.status(status).json({ data: null, error: err.message || "Playback session failed" });
    }
}

async function getPlaybackObject(req, res) {
    const mediaId = req.params[0];
    const requestedPath = req.params[1];
    const relativePath = normalizePlaybackPath(requestedPath);

    try {
        if (!isSafeRelativePath(relativePath)) {
            console.warn(`[media-playback] object rejected mediaId=${mediaId} requestedPath=${requestedPath} reason=unsafe_path`);
            res.status(400).json({ data: null, error: "Invalid media path" });
            return;
        }

        const asset = await mediaPlaybackService.authorizePlaybackRequest(
            mediaId,
            req.headers.cookie
        );
        const prefix = String(asset.hls_storage_prefix || `media/${asset.id}`).replace(/\/+$/g, "");
        const key = `${prefix}/${relativePath}`;
        console.log(`[media-playback] object request mediaId=${mediaId} requestedPath=${requestedPath} normalizedPath=${relativePath} key=${key}`);
        const stat = await minioStorageService.statObject(key);
        const stream = await minioStorageService.getObjectStream(key);

        setMediaHeaders(res, key, stat.metaData?.["content-type"]);
        res.on("finish", () => {
            console.log(`[media-playback] object served mediaId=${mediaId} status=${res.statusCode} key=${key}`);
        });
        stream.pipe(res);
    } catch (err) {
        console.error(`[media-playback] object failed mediaId=${mediaId} requestedPath=${requestedPath} normalizedPath=${relativePath} error=${err.message}`);
        res.status(403).json({ data: null, error: err.message || "Media not available" });
    }
}

module.exports = {
    createPlaybackSession,
    getPlaybackObject,
    getMedia
};
