/*
User repository
- db access for user entity
*/

const db = require("../db/db");

const PUBLIC_USER_FIELDS = "id, username, display_name, bio, avatar_url, status, created_at, last_login_at";
let hasLegacyEmailColumnCache = null;

async function hasLegacyEmailColumn() {
    if (hasLegacyEmailColumnCache !== null) {
        return hasLegacyEmailColumnCache;
    }

    const [rows] = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'users'
           AND column_name = 'email'`
    );
    hasLegacyEmailColumnCache = rows.length > 0;
    return hasLegacyEmailColumnCache;
}

async function createUser({ username, emailHash, passwordHash }) {
    const legacyEmailColumn = await hasLegacyEmailColumn();
    const query = legacyEmailColumn
        ? "INSERT INTO users (username, email_hash, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?) RETURNING id"
        : "INSERT INTO users (username, email_hash, password_hash, display_name) VALUES (?, ?, ?, ?) RETURNING id";
    const values = legacyEmailColumn
        ? [username, emailHash, emailHash, passwordHash, username]
        : [username, emailHash, passwordHash, username];
    const [result] = await db.query(query, values);

    return result.insertId;
}

async function findByEmailHash(emailHash) {
    const [rows] = await db.query(
        "SELECT * FROM users WHERE email_hash = ?",
        [emailHash]
    );

    return rows[0];
}

async function findById(id) {
    const [rows] = await db.query(
        `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ?`,
        [id]
    );

    return rows[0];
}

async function findManyByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        return [];
    }

    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id IN (${placeholders})`,
        ids
    );

    return rows;
}

async function updateUser(userId, fields) {
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
        if (typeof value === "undefined") {
            continue;
        }

        updates.push(`${key} = ?`);
        values.push(value);
    }

    if (updates.length === 0) {
        return findById(userId);
    }

    values.push(userId);

    await db.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        values
    );

    return findById(userId);
}

async function updateLastLoginAt(userId) {
    await db.query(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
        [userId]
    );
}

module.exports = {
    createUser,
    findByEmailHash,
    findById,
    findManyByIds,
    updateUser,
    updateLastLoginAt
};
