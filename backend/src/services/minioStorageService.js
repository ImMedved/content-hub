const { Client } = require("minio");
const path = require("path");

const DEFAULT_BUCKET = "content-images";

let client = null;
let bucketReady = false;

function getBucket() {
    return process.env.MINIO_BUCKET_IMAGES || process.env.MINIO_BUCKET || DEFAULT_BUCKET;
}

function getClient() {
    if (client) {
        return client;
    }

    client = new Client({
        endPoint: process.env.MINIO_ENDPOINT || "localhost",
        port: Number(process.env.MINIO_PORT || 9000),
        useSSL: String(process.env.MINIO_USE_SSL || "false").toLowerCase() === "true",
        accessKey: process.env.MINIO_ACCESS_KEY || "contenthub",
        secretKey: process.env.MINIO_SECRET_KEY || "contenthub-password"
    });

    return client;
}

async function ensureBucket() {
    if (bucketReady) {
        return;
    }

    const minio = getClient();
    const bucket = getBucket();
    const exists = await minio.bucketExists(bucket).catch((err) => {
        if (err?.code === "NoSuchBucket") {
            return false;
        }
        throw err;
    });

    if (!exists) {
        await minio.makeBucket(bucket);
    }

    bucketReady = true;
}

function extensionFromFilename(filename, fallback = "bin") {
    const extension = path.extname(String(filename || "")).replace(".", "").toLowerCase();
    return extension || fallback;
}

function buildObjectKey(prefix, filename, extensionFallback = "bin") {
    const extension = extensionFromFilename(filename, extensionFallback);
    const safePrefix = String(prefix || "uploads").replace(/^\/+|\/+$/g, "");
    return `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
}

function buildMediaUrl(key) {
    return `/api/v1/media/${encodeURIComponent(key)}`;
}

async function putObject({ key, buffer, contentType }) {
    await ensureBucket();
    await getClient().putObject(getBucket(), key, buffer, buffer.length, {
        "Content-Type": contentType || "application/octet-stream"
    });

    return {
        bucket: getBucket(),
        key,
        url: buildMediaUrl(key)
    };
}

async function getObjectStream(key) {
    await ensureBucket();
    return getClient().getObject(getBucket(), key);
}

async function statObject(key) {
    await ensureBucket();
    return getClient().statObject(getBucket(), key);
}

module.exports = {
    buildMediaUrl,
    buildObjectKey,
    getBucket,
    getObjectStream,
    putObject,
    statObject
};
