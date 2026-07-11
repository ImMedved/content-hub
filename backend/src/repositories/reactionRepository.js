/*
Reaction repository
- add/remove reaction
*/

const db = require("../db/db");

async function addReaction(userId, postId, type) {
    await db.query(
        `INSERT INTO reaction (user_id, post_id, type)
         VALUES (?, ?, ?)
         ON CONFLICT (user_id, post_id) DO UPDATE SET type = EXCLUDED.type`,
        [userId, postId, type]
    );
}

async function removeReaction(userId, postId) {
    await db.query(
        "DELETE FROM reaction WHERE user_id = ? AND post_id = ?",
        [userId, postId]
    );
}

async function getReactions(postId) {
    const [rows] = await db.query(
        "SELECT type, COUNT(*) as count FROM reaction WHERE post_id = ? GROUP BY type",
        [postId]
    );

    return rows;
}

module.exports = {
    addReaction,
    removeReaction,
    getReactions
};
