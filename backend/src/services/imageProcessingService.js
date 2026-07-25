const minioStorageService = require("./minioStorageService");
const { saveBuffer } = require("../utils/mediaStorage");

function isConfigured(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function normalizeServiceUrl(value) {
    return String(value || "").replace(/\/+$/, "");
}

function getRequestTimeoutMs(envName, fallbackMs) {
    const value = Number(process.env[envName] || fallbackMs);
    return Number.isFinite(value) && value > 0 ? value : fallbackMs;
}

function buildAbortSignal(envName, fallbackMs) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return AbortSignal.timeout(getRequestTimeoutMs(envName, fallbackMs));
    }

    return undefined;
}

function normalizeAnalysisPayload(payload) {
    const tags = Array.isArray(payload?.tags)
        ? payload.tags.map((tag) => tag?.value).filter(Boolean)
        : [];

    return {
        status: payload?.pipelineStatus || "completed",
        payload,
        tags,
        ocrText: payload?.recognizedText || payload?.ocr?.displayText || payload?.ocr?.rawText || null,
        caption: payload?.caption || null
    };
}

function skippedAnalysis(reason) {
    return {
        status: "skipped",
        payload: reason ? { skipped: true, reason } : null,
        tags: [],
        ocrText: null,
        caption: null
    };
}

async function postMultipartFile(url, buffer, filename, contentType, extraFields = {}) {
    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: contentType || "application/octet-stream" }), filename);

    for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, String(value));
    }

    const response = await fetch(url, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Service request failed with status ${response.status}`);
    }

    return response;
}

async function analyzeImage({ buffer, filename, contentType }) {
    if (!isConfigured(process.env.ANALYSIS_SERVICE_URL)) {
        return skippedAnalysis("analysis_service_url_not_configured");
    }

    try {
        const baseUrl = normalizeServiceUrl(process.env.ANALYSIS_SERVICE_URL);
        const response = await postMultipartFile(`${baseUrl}/analyze`, buffer, filename, contentType, {
            topTags: process.env.ANALYSIS_TOP_TAGS || 10,
            includeDebug: false
        });
        const payload = await response.json();
        return normalizeAnalysisPayload(payload);
    } catch (err) {
        return skippedAnalysis(err.message);
    }
}

async function analyzeImageFromMinio({ sourceKey, filename, contentType }) {
    if (!isConfigured(process.env.ANALYSIS_SERVICE_URL)) {
        return skippedAnalysis("analysis_service_url_not_configured");
    }

    try {
        const baseUrl = normalizeServiceUrl(process.env.ANALYSIS_SERVICE_URL);
        const response = await fetch(`${baseUrl}/analyze-minio`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            signal: buildAbortSignal("ANALYSIS_REQUEST_TIMEOUT_MS", 90000),
            body: JSON.stringify({
                bucket: minioStorageService.getBucket(),
                sourceKey,
                filename,
                contentType,
                topTags: Number(process.env.ANALYSIS_TOP_TAGS || 10),
                includeDebug: String(process.env.ANALYSIS_INCLUDE_DEBUG || "false").toLowerCase() === "true",
                enhance: String(process.env.ANALYSIS_ENHANCE || "false").toLowerCase() === "true",
                mode: process.env.ANALYSIS_MODE || undefined,
                ocrPolicy: process.env.ANALYSIS_OCR_POLICY || undefined
            })
        });

        if (!response.ok) {
            throw new Error(`Analysis service failed with status ${response.status}`);
        }

        const payload = await response.json();
        return normalizeAnalysisPayload(payload);
    } catch (err) {
        return skippedAnalysis(err.message);
    }
}

async function createThumbnail({ buffer, filename, contentType }) {
    if (!isConfigured(process.env.THUMBNAIL_SERVICE_URL)) {
        return null;
    }

    try {
        const baseUrl = normalizeServiceUrl(process.env.THUMBNAIL_SERVICE_URL);
        const response = await postMultipartFile(`${baseUrl}/thumbnail`, buffer, filename, contentType, {
            size: process.env.THUMBNAIL_SIZE || 512
        });
        const thumbnailBuffer = Buffer.from(await response.arrayBuffer());
        return saveBuffer(thumbnailBuffer, "thumb", "jpg");
    } catch {
        return null;
    }
}

async function createThumbnailFromMinio({ sourceKey, destinationKey = null, size = 256, mode = "square" }) {
    if (!isConfigured(process.env.THUMBNAIL_SERVICE_URL)) {
        return null;
    }

    try {
        const baseUrl = normalizeServiceUrl(process.env.THUMBNAIL_SERVICE_URL);
        const response = await fetch(`${baseUrl}/thumbnail/minio`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                bucket: minioStorageService.getBucket(),
                sourceKey,
                destinationKey: destinationKey || sourceKey.replace(/^originals\//, "thumbnails/").replace(/\.[^.]+$/, `-${size}.jpg`),
                size,
                mode
            })
        });

        if (!response.ok) {
            throw new Error(`Thumbnail service failed with status ${response.status}`);
        }

        const payload = await response.json();
        const key = payload.thumbnailKey || payload.destinationKey;

        return key
            ? {
                key,
                url: minioStorageService.buildMediaUrl(key)
            }
            : null;
    } catch {
        return null;
    }
}

async function compressMinioObject({ sourceKey, destinationKey }) {
    if (!isConfigured(process.env.COMPRESS_SERVICE_URL)) {
        return null;
    }

    try {
        const baseUrl = normalizeServiceUrl(process.env.COMPRESS_SERVICE_URL);
        const response = await fetch(`${baseUrl}/compress`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                bucket: minioStorageService.getBucket(),
                sourceKey,
                destinationKey
            })
        });

        if (!response.ok) {
            throw new Error(`Compress service failed with status ${response.status}`);
        }

        const payload = await response.json();
        const key = payload.compressedKey || payload.destinationKey;

        return key
            ? {
                key,
                url: minioStorageService.buildMediaUrl(key)
            }
            : null;
    } catch {
        return null;
    }
}

module.exports = {
    analyzeImage,
    analyzeImageFromMinio,
    compressMinioObject,
    createThumbnail,
    createThumbnailFromMinio
};
