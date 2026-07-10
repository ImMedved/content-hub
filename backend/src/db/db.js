/*
DB config
- switch env (test/dev)
*/

const mysql = require("mysql2/promise");
require("dotenv").config({
    path: process.env.NODE_ENV === "test" ? ".env.test" : ".env"
});

const fs = require("fs");
const path = require("path");
const { getEmailHash } = require("../utils/emailSecurity");

// create pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// read and execute schema
async function createSchema() {
    const schemaPath = path.join(__dirname, "../../../database/schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    const statements = schema
        .split(";")
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0)
        .filter(stmt => !/^DROP TABLE IF EXISTS/i.test(stmt));

    for (const statement of statements) {
        try {
            await pool.query(statement);
        } catch (err) {
            if (err && (err.code === "ER_TABLE_EXISTS_ERROR" || err.code === "ER_DUP_ENTRY")) {
                continue;
            }

            throw err;
        }
    }

    await ensureHashedEmails();
}

async function ensureHashedEmails() {
    const [emailColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'email'");
    const [emailHashColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'email_hash'");

    if (emailColumns.length === 0 && emailHashColumns.length === 0) {
        return;
    }

    if (emailHashColumns.length === 0) {
        await pool.query("ALTER TABLE users ADD COLUMN email_hash VARCHAR(255) NULL UNIQUE AFTER username");
    }

    const selectFields = emailColumns.length > 0
        ? "id, email, email_hash"
        : "id, email_hash";
    const [rows] = await pool.query(`SELECT ${selectFields} FROM users`);

    for (const row of rows) {
        const sourceValue = row.email || row.email_hash;
        const nextHash = sourceValue ? getEmailHash(sourceValue) : null;

        if (!nextHash) {
            continue;
        }

        if (emailColumns.length > 0) {
            await pool.query(
                "UPDATE users SET email_hash = ?, email = ? WHERE id = ?",
                [nextHash, nextHash, row.id]
            );
        } else if (!row.email_hash) {
            await pool.query(
                "UPDATE users SET email_hash = ? WHERE id = ?",
                [nextHash, row.id]
            );
        }
    }

    await pool.query("ALTER TABLE users MODIFY email_hash VARCHAR(255) NOT NULL");
}

module.exports = pool;
module.exports.createSchema = createSchema;
