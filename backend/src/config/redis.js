/*
Redis config
- client init
- cache connection
*/

const { createClient } = require("redis");

function isRedisDisabled() {
    const value = String(process.env.DB_ONLY || process.env.DISABLE_REDIS || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes";
}

const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    socket: {
        connectTimeout: 1000,
        reconnectStrategy: false
    }
});

redisClient.on("error", (err) => {
    console.error("Redis error:", err.message);
});

function attachRedisLogging(client, label = "Redis") {
    client.on("error", (err) => {
        console.error(`${label} error:`, err.message);
    });
}

async function connectRedisIfAvailable() {
    if (isRedisDisabled()) {
        return false;
    }

    if (redisClient.isOpen) {
        return true;
    }

    try {
        await redisClient.connect();
        return true;
    } catch (err) {
        console.warn("Redis unavailable, continuing without cache.");
        return false;
    }
}

async function createRedisSubscriberIfAvailable() {
    if (isRedisDisabled()) {
        return null;
    }

    const ready = await connectRedisIfAvailable();

    if (!ready) {
        return null;
    }

    const subscriber = redisClient.duplicate({
        socket: {
            connectTimeout: 1000,
            reconnectStrategy: false
        }
    });

    attachRedisLogging(subscriber, "Redis subscriber");

    try {
        await subscriber.connect();
        return subscriber;
    } catch (err) {
        console.warn("Redis subscriber unavailable, continuing without pub/sub.");
        try {
            await subscriber.quit();
        } catch (quitError) {
        }
        return null;
    }
}

module.exports = redisClient;
module.exports.connectRedisIfAvailable = connectRedisIfAvailable;
module.exports.createRedisSubscriberIfAvailable = createRedisSubscriberIfAvailable;
module.exports.isRedisDisabled = isRedisDisabled;
