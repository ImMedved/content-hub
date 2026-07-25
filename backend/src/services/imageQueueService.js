const redisClient = require("../config/redis");
const postRepo = require("../repositories/postRepository");
const imageProcessingService = require("./imageProcessingService");
const tagCacheService = require("./tagCacheService");

const QUEUE_KEY = "queue:image_processing";
const RETRY_DELAY_MS = 1500;

let running = false;
let workerPromise = null;
let queueClient = null;

function buildCompressedKey(sourceKey, prefix) {
    return sourceKey.replace(/^([^/]+)\//, `${prefix}/$1/`).replace(/\.[^.]+$/, ".webp");
}

async function enqueueImageProcessing(postId) {
    const payload = JSON.stringify({ postId: Number(postId), queuedAt: Date.now() });

    if (redisClient.isOpen) {
        await redisClient.rPush(QUEUE_KEY, payload);
        return;
    }

    setImmediate(() => {
        processImageJob({ postId: Number(postId) }).catch((err) => {
            console.warn("Inline image processing failed:", err.message);
        });
    });
}

async function processImageJob(job) {
    const postId = Number(job?.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
        return;
    }

    const asset = await postRepo.getImageAssetByPostId(postId);
    if (!asset?.original_storage_key) {
        return;
    }

    await postRepo.updateImageAssetProcessing(postId, { processing_status: "processing" });

    const sourceKey = asset.original_storage_key;
    const squareKey = sourceKey.replace(/^originals\//, "thumbnails/").replace(/\.[^.]+$/, "-256.jpg");
    const feedKey = sourceKey.replace(/^originals\//, "feed-thumbnails/").replace(/\.[^.]+$/, "-960.jpg");

    const [analysis, squareThumbnail, feedThumbnail] = await Promise.all([
        imageProcessingService.analyzeImageFromMinio({
            sourceKey,
            filename: sourceKey.split("/").pop(),
            contentType: "image/*"
        }),
        imageProcessingService.createThumbnailFromMinio({
            sourceKey,
            destinationKey: squareKey,
            size: 256,
            mode: "square"
        }),
        imageProcessingService.createThumbnailFromMinio({
            sourceKey,
            destinationKey: feedKey,
            size: Number(process.env.FEED_THUMBNAIL_SIZE || 960),
            mode: "fit"
        })
    ]);

    const originalCompressedKey = buildCompressedKey(sourceKey, "compressed");
    const squareCompressedKey = squareThumbnail?.key ? buildCompressedKey(squareThumbnail.key, "compressed") : null;
    const feedCompressedKey = feedThumbnail?.key ? buildCompressedKey(feedThumbnail.key, "compressed") : null;

    const [compressedOriginal, compressedSquare, compressedFeed] = await Promise.all([
        imageProcessingService.compressMinioObject({
            sourceKey,
            destinationKey: originalCompressedKey
        }),
        squareThumbnail && squareCompressedKey
            ? imageProcessingService.compressMinioObject({
                sourceKey: squareThumbnail.key,
                destinationKey: squareCompressedKey
            })
            : Promise.resolve(null),
        feedThumbnail && feedCompressedKey
            ? imageProcessingService.compressMinioObject({
                sourceKey: feedThumbnail.key,
                destinationKey: feedCompressedKey
            })
            : Promise.resolve(null)
    ]);

    await postRepo.updateImageAssetProcessing(postId, {
        compressed_url: compressedOriginal?.url || null,
        thumbnail_url: compressedSquare?.url || null,
        feed_thumbnail_url: compressedFeed?.url || null,
        compressed_storage_key: compressedOriginal?.key || null,
        thumbnail_storage_key: compressedSquare?.key || null,
        feed_thumbnail_storage_key: compressedFeed?.key || null,
        analysis_status: analysis.status,
        analysis_payload: analysis.payload,
        ocr_text: analysis.ocrText,
        caption: analysis.caption,
        processing_status: compressedOriginal ? "completed" : "partial"
    });

    await postRepo.updateImagePostMedia(postId, {
        contentUrl: compressedOriginal?.url || null,
        previewUrl: compressedFeed?.url || compressedSquare?.url || null
    });

    const postService = require("./postService");
    if (Array.isArray(analysis.tags) && analysis.tags.length > 0) {
        const existingTags = postRepo.getPostTagMap
            ? (await postRepo.getPostTagMap([postId])).get(postId) || []
            : [];
        const mergedTags = [...new Set([...existingTags, ...analysis.tags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)])];
        await postRepo.syncTags(postId, mergedTags);
        await tagCacheService.addTags(mergedTags);
    }
    await postService.invalidateImageCaches(asset.owner_id);
}

async function nextJob() {
    if (!redisClient.isOpen) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return null;
    }

    if (!queueClient || !queueClient.isOpen) {
        queueClient = redisClient.duplicate();
        queueClient.on("error", (err) => {
            console.error("Redis image queue error:", err.message);
        });
        await queueClient.connect();
    }

    const payload = await queueClient.blPop(QUEUE_KEY, 5);
    if (!payload?.element) {
        return null;
    }

    return JSON.parse(payload.element);
}

async function workerLoop() {
    while (running) {
        try {
            const job = await nextJob();
            if (job) {
                await processImageJob(job);
            }
        } catch (err) {
            console.warn("Image processing queue failed:", err.message);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
}

function startImageQueueWorker() {
    if (running || String(process.env.IMAGE_QUEUE_WORKER || "true").toLowerCase() === "false") {
        return;
    }

    running = true;
    workerPromise = workerLoop();
}

async function stopImageQueueWorker() {
    running = false;
    await workerPromise;
    if (queueClient?.isOpen) {
        await queueClient.quit();
    }
}

module.exports = {
    enqueueImageProcessing,
    processImageJob,
    startImageQueueWorker,
    stopImageQueueWorker
};
