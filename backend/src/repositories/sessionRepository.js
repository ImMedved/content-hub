/*
Session repository
- session storage
*/

const db = require("../db/db");

// save session
async function createSession(userId, token) {
    await db.query(
        "INSERT INTO session (user_id, token) VALUES (?, ?)",
        [userId, token]
    );
}

module.exports = {
    createSession
};