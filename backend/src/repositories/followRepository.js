/*
Follow repository
- follow/unfollow
- subscriptions
- followers list
*/

const db = require("../db/db");

async function follow(followerId, followingId) {
    await db.query(
        "INSERT INTO follow (follower_id, following_id) VALUES (?, ?)",
        [followerId, followingId]
    );
}

async function unfollow(followerId, followingId) {
    await db.query(
        "DELETE FROM follow WHERE follower_id = ? AND following_id = ?",
        [followerId, followingId]
    );
}

async function getFollowing(userId) {
    const [rows] = await db.query(
        "SELECT following_id FROM follow WHERE follower_id = ?",
        [userId]
    );

    return rows.map((r) => r.following_id);
}

async function getFollowers(userId) {
    const [rows] = await db.query(
        "SELECT follower_id FROM follow WHERE following_id = ?",
        [userId]
    );

    return rows.map((r) => r.follower_id);
}

async function isFollowing(followerId, followingId) {
    const [rows] = await db.query(
        "SELECT 1 FROM follow WHERE follower_id = ? AND following_id = ? LIMIT 1",
        [followerId, followingId]
    );

    return rows.length > 0;
}

module.exports = {
    follow,
    unfollow,
    getFollowing,
    getFollowers,
    isFollowing
};
