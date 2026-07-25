const redisClient = require("../config/redis");

function isReady() {
    return Boolean(redisClient?.isOpen);
}

async function readJson(key) {
    if (!isReady()) {
        return null;
    }

    try {
        const cached = await redisClient.get(key);
        return cached ? JSON.parse(cached) : null;
    } catch (err) {
        console.warn(`Redis read failed for ${key}:`, err.message);
        return null;
    }
}

async function writeJson(key, value, ttlSeconds = 60) {
    if (!isReady()) {
        return false;
    }

    try {
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
        return true;
    } catch (err) {
        console.warn(`Redis write failed for ${key}:`, err.message);
        return false;
    }
}

async function deleteKeys(keys) {
    if (!isReady() || !Array.isArray(keys) || keys.length === 0) {
        return;
    }

    try {
        await redisClient.del(keys);
    } catch (err) {
        console.warn("Redis delete failed:", err.message);
    }
}

async function getSet(key, loader, ttlSeconds = 300) {
    if (!isReady()) {
        return loader();
    }

    try {
        const cached = await redisClient.sMembers(key);
        if (cached.length > 0) {
            await redisClient.expire(key, ttlSeconds);
            return cached.map(Number).filter(Number.isFinite);
        }

        const values = await loader();
        if (Array.isArray(values) && values.length > 0) {
            await redisClient.sAdd(key, values.map(String));
            await redisClient.expire(key, ttlSeconds);
        }
        return values;
    } catch (err) {
        console.warn(`Redis set cache failed for ${key}:`, err.message);
        return loader();
    }
}

async function replaceSet(key, values, ttlSeconds = 300) {
    if (!isReady()) {
        return;
    }

    try {
        const pipeline = redisClient.multi();
        pipeline.del(key);
        if (Array.isArray(values) && values.length > 0) {
            pipeline.sAdd(key, values.map(String));
        }
        pipeline.expire(key, ttlSeconds);
        await pipeline.exec();
    } catch (err) {
        console.warn(`Redis set replace failed for ${key}:`, err.message);
    }
}

function followingKey(userId) {
    return `following:${userId}`;
}

function followersKey(userId) {
    return `followers:${userId}`;
}

function reactionCountKey(postId) {
    return `post:${postId}:reaction_count`;
}

function commentCountKey(postId) {
    return `post:${postId}:comment_count`;
}

function latestProfileImagesKey(userId) {
    return `profile:${userId}:latest_images`;
}

module.exports = {
    commentCountKey,
    deleteKeys,
    followersKey,
    followingKey,
    getSet,
    isReady,
    latestProfileImagesKey,
    reactionCountKey,
    readJson,
    replaceSet,
    writeJson
};
