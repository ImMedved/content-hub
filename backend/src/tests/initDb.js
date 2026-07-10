/*
Init test DB
- create tables
*/

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const db = require("../db/db");

module.exports = async function initDb() {
    const adminConnection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    await adminConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``
    );
    await adminConnection.end();

    const schema = fs.readFileSync(
        path.join(__dirname, "../../../database/schema.sql"),
        "utf-8"
    );

    const queries = schema
        .split(";")
        .map(q => q.trim())
        .filter(q => q.length);

    await db.query("SET FOREIGN_KEY_CHECKS = 0");

    try {
        await db.query("DROP TABLE IF EXISTS users_role");
        await db.query("DROP TABLE IF EXISTS users");

        for (const query of queries) {
            await db.query(query);
        }
    } finally {
        await db.query("SET FOREIGN_KEY_CHECKS = 1");
    }
};
