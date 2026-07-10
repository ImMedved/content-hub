const db = require("../db/db");

async function createWallet(userId, initialBalance = 100) {
    await db.query(
        "INSERT INTO wallet (user_id, balance) VALUES (?, ?)",
        [userId, initialBalance]
    );
}

async function getWallet(userId) {
    const [rows] = await db.query(
        "SELECT user_id, balance FROM wallet WHERE user_id = ?",
        [userId]
    );

    return rows[0] || null;
}

module.exports = {
    createWallet,
    getWallet
};
