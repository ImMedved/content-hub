const postRepo = require("../repositories/postRepository");
const minioStorageService = require("./minioStorageService");

function getCompressServiceUrl() {
    return String(process.env.COMPRESS_SERVICE_URL || "http://localhost:8092").replace(/\/+$/g, "");
}

async function requestHlsTranscode({ mediaId, sourceKey, hlsStoragePrefix }) {
    const response = await fetch(`${getCompressServiceUrl()}/video/hls`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            bucket: minioStorageService.getBucket(),
            mediaId,
            sourceKey,
            destinationPrefix: hlsStoragePrefix
        })
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(body.error || "Video compressor failed");
    }

    return body;
}

async function processVideo({ mediaId, sourceKey, hlsStoragePrefix }) {
    try {
        await postRepo.markVideoProcessingStarted(mediaId);
        const result = await requestHlsTranscode({ mediaId, sourceKey, hlsStoragePrefix });
        await postRepo.markVideoPlayable(mediaId, result);
    } catch (err) {
        await postRepo.markVideoProcessingFailed(mediaId, err.message);
        throw err;
    }
}

function processVideoInBackground(payload) {
    setImmediate(() => {
        processVideo(payload).catch((err) => {
            console.error("Video processing failed:", err.message);
        });
    });
}

module.exports = {
    processVideo,
    processVideoInBackground
};
