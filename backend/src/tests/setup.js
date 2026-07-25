/*
Global test setup
- clear db
- reset redis
*/

const db = require("../db/db");
const redisClient = require("../config/redis");
const initDb = require("./initDb");

jest.setTimeout(30000);

beforeAll(async () => {
    await redisClient.connectRedisIfAvailable();
    await initDb();
});

beforeEach(async () => {
    await db.query("DELETE FROM media_master_revision");
    await db.query("DELETE FROM media_rendition");
    await db.query("DELETE FROM media_job");
    await db.query("DELETE FROM media_asset");
    await db.query("DELETE FROM direct_message");
    await db.query("DELETE FROM reaction");
    await db.query("DELETE FROM comment");
    await db.query("DELETE FROM follow");
    await db.query("DELETE FROM access_grant");
    await db.query("DELETE FROM payment_transaction");
    await db.query("DELETE FROM post_content");
    await db.query("DELETE FROM post_access");
    await db.query("DELETE FROM post_tag");
    await db.query("DELETE FROM tag");
    await db.query("DELETE FROM post");
    await db.query("DELETE FROM wallet");
    await db.query("DELETE FROM users_role");
    await db.query("DELETE FROM session");
    await db.query("DELETE FROM users");

    if (redisClient.isOpen) {
        await redisClient.flushAll();
    }
});

afterAll(async () => {
    if (redisClient.isOpen) {
        await redisClient.quit();
    }
    await db.end();
});
