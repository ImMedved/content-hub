const postRepo = require("../repositories/postRepository");
const minioStorageService = require("./minioStorageService");

function getCompressServiceUrl() {
    return String(process.env.COMPRESS_SERVICE_URL || "http://localhost:8092").replace(/\/+$/g, "");
}

async function requestHlsTranscode({ mediaId, sourceKey, hlsStoragePrefix }) {
    const startedAt = Date.now();
    console.log(`[audio-processing] request compress start mediaId=${mediaId} sourceKey=${sourceKey} hlsPrefix=${hlsStoragePrefix}`);
    const response = await fetch(`${getCompressServiceUrl()}/audio/hls`, {
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
        console.error(`[audio-processing] request compress failed mediaId=${mediaId} status=${response.status} durationMs=${Date.now() - startedAt} error=${body.error || "unknown"}`);
        throw new Error(body.error || "Audio compressor failed");
    }

    console.log(`[audio-processing] request compress done mediaId=${mediaId} durationMs=${Date.now() - startedAt} masterKey=${body.masterKey || "none"} waveformKey=${body.waveformKey || "none"}`);
    return body;
}

async function processAudio({ mediaId, sourceKey, hlsStoragePrefix }) {
    console.log(`[audio-processing] job start mediaId=${mediaId} sourceKey=${sourceKey}`);
    try {
        await postRepo.markAudioProcessingStarted(mediaId);
        const result = await requestHlsTranscode({ mediaId, sourceKey, hlsStoragePrefix });
        await postRepo.markAudioPlayable(mediaId, result);
        console.log(`[audio-processing] job finished mediaId=${mediaId} status=playable renditions=${Array.isArray(result.renditions) ? result.renditions.length : 0}`);
    } catch (err) {
        await postRepo.markAudioProcessingFailed(mediaId, err.message);
        console.error(`[audio-processing] job failed mediaId=${mediaId} error=${err.message}`);
        throw err;
    }
}

function processAudioInBackground(payload) {
    setImmediate(() => {
        processAudio(payload).catch((err) => {
            console.error("Audio processing failed:", err.message);
        });
    });
}

module.exports = {
    processAudio,
    processAudioInBackground
};
