/*
Init test DB
- create tables
*/

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const db = require("../db/db");
const { splitSqlStatements } = require("../db/postgres/statementSplitter");

module.exports = async function initDb() {
    const adminConnection = new Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: "postgres"
    });

    await adminConnection.connect();

    const databaseExists = await adminConnection.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [process.env.DB_NAME]
    );

    if (databaseExists.rowCount === 0) {
        await adminConnection.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    }

    await adminConnection.end();

    const schemaPathCandidates = [
        path.join(__dirname, "../../database/schema.sql"),
        path.join(__dirname, "../../../database/schema.sql")
    ];
    const schemaPath = schemaPathCandidates.find((candidate) => fs.existsSync(candidate));

    if (!schemaPath) {
        throw new Error("database/schema.sql not found");
    }

    const schema = fs.readFileSync(schemaPath, "utf-8");

    await db.query("DROP SCHEMA IF EXISTS public CASCADE");
    await db.query("CREATE SCHEMA public");
    const statements = splitSqlStatements(schema);

    for (const statement of statements) {
        await db.query(statement);
    }
};
