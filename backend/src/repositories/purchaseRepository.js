const db = require("../db/db");

async function getAccessiblePostIds(userId, postIds) {
    if (!userId || !Array.isArray(postIds) || postIds.length === 0) {
        return [];
    }

    const placeholders = postIds.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT post_id FROM access_grant WHERE user_id = ? AND post_id IN (${placeholders})`,
        [userId, ...postIds]
    );

    return rows.map((row) => Number(row.post_id));
}

async function purchasePost(userId, post) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [[wallet]] = await connection.query(
            "SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE",
            [userId]
        );

        if (!wallet) {
            throw new Error("Wallet not found");
        }

        const [[existingGrant]] = await connection.query(
            "SELECT post_id FROM access_grant WHERE user_id = ? AND post_id = ? FOR UPDATE",
            [userId, post.id]
        );

        if (existingGrant) {
            await connection.rollback();
            return { alreadyOwned: true, balance: Number(wallet.balance) };
        }

        const price = Number(post.price || 0);

        if (Number(wallet.balance) < price) {
            throw new Error("Insufficient funds");
        }

        const commissionRate = 10;
        const commissionAmount = Number((price * (commissionRate / 100)).toFixed(2));
        const sellerIncome = Number((price * (1 - commissionRate / 100)).toFixed(2));

        await connection.query(
            "UPDATE wallet SET balance = balance - ? WHERE user_id = ?",
            [price, userId]
        );

        await connection.query(
            "UPDATE wallet SET balance = balance + ? WHERE user_id = ?",
            [sellerIncome, post.author_id]
        );

        const [transactionResult] = await connection.query(
            `INSERT INTO payment_transaction
                (user_id, related_user_id, post_id, type, commission, amount, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, post.author_id, post.id, "purchase", commissionRate, price, "completed"]
        );

        await connection.query(
            "INSERT INTO access_grant (user_id, post_id, transaction_id, type) VALUES (?, ?, ?, ?)",
            [userId, post.id, transactionResult.insertId, "purchase"]
        );

        const [[updatedWallet]] = await connection.query(
            "SELECT balance FROM wallet WHERE user_id = ?",
            [userId]
        );

        await connection.commit();

        return {
            alreadyOwned: false,
            balance: Number(updatedWallet.balance),
            commissionAmount,
            sellerIncome
        };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

module.exports = {
    getAccessiblePostIds,
    purchasePost
};
