const redisClient = require("../config/redis");
const postRepo = require("../repositories/postRepository");

const TAG_CATALOG_KEY = "tags:catalog";

async function ensureCatalogLoaded() {
    if (!redisClient.isOpen) {
        return false;
    }

    try {
        const existingCount = await redisClient.zCard(TAG_CATALOG_KEY);

        if (existingCount > 0) {
            return true;
        }

        const tags = await postRepo.listAllTags();

        if (tags.length > 0) {
            await redisClient.zAdd(
                TAG_CATALOG_KEY,
                tags.map((tag) => ({ score: 0, value: tag }))
            );
        }

        return true;
    } catch (err) {
        console.warn("Redis tag catalog bootstrap failed:", err.message);
        return false;
    }
}

async function addTags(tags) {
    if (!redisClient.isOpen || !Array.isArray(tags) || tags.length === 0) {
        return;
    }

    const normalizedTags = tags
        .map((tag) => String(tag || "").trim().toLowerCase())
        .filter(Boolean);

    if (normalizedTags.length === 0) {
        return;
    }

    try {
        await redisClient.zAdd(
            TAG_CATALOG_KEY,
            normalizedTags.map((tag) => ({ score: 0, value: tag }))
        );
    } catch (err) {
        console.warn("Redis tag catalog update failed:", err.message);
    }
}

async function getSuggestions(query = "", limit = 8) {
    if (!redisClient.isOpen) {
        return null;
    }

    const ready = await ensureCatalogLoaded();

    if (!ready) {
        return null;
    }

    const normalizedQuery = String(query || "").trim().toLowerCase();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 20));

    try {
        if (!normalizedQuery) {
            return redisClient.zRange(TAG_CATALOG_KEY, 0, safeLimit - 1);
        }

        const upperBound = `${normalizedQuery}\xff`;
        return redisClient.zRangeByLex(
            TAG_CATALOG_KEY,
            `[${normalizedQuery}`,
            `[${upperBound}`,
            {
                LIMIT: {
                    offset: 0,
                    count: safeLimit
                }
            }
        );
    } catch (err) {
        console.warn("Redis tag suggestion lookup failed:", err.message);
        return null;
    }
}

module.exports = {
    addTags,
    getSuggestions
};
