const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getEmailHash } = require("../../utils/emailSecurity");
const { splitSqlStatements } = require("./statementSplitter");

function getSchemaPath() {
    const candidates = [
        path.join(__dirname, "../../../database/schema.sql"),
        path.join(__dirname, "../../../../database/schema.sql")
    ];

    const schemaPath = candidates.find((candidate) => fs.existsSync(candidate));

    if (!schemaPath) {
        throw new Error("database/schema.sql not found");
    }

    return schemaPath;
}

function readSchema() {
    return fs.readFileSync(getSchemaPath(), "utf8");
}

function getSchemaHash(schema) {
    return crypto.createHash("sha256").update(schema).digest("hex");
}

async function ensureMetadataTable(pool) {
    await pool.query("CREATE SCHEMA IF NOT EXISTS platform_meta");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS platform_meta.schema_state (
            schema_name TEXT PRIMARY KEY,
            schema_hash TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function readStoredHash(pool, schemaName) {
    const result = await pool.query(
        "SELECT schema_hash FROM platform_meta.schema_state WHERE schema_name = $1",
        [schemaName]
    );

    return result.rows[0]?.schema_hash || null;
}

async function writeStoredHash(pool, schemaName, schemaHash) {
    await pool.query(
        `INSERT INTO platform_meta.schema_state (schema_name, schema_hash, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (schema_name)
         DO UPDATE SET schema_hash = EXCLUDED.schema_hash, updated_at = EXCLUDED.updated_at`,
        [schemaName, schemaHash]
    );
}

async function resetPublicSchema(pool) {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("GRANT ALL ON SCHEMA public TO postgres");
    await pool.query("GRANT ALL ON SCHEMA public TO public");
}

async function applySchema(pool, schema) {
    const statements = splitSqlStatements(schema);

    for (const statement of statements) {
        await pool.query(statement);
    }
}

async function columnExists(pool, tableName, columnName) {
    const result = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2`,
        [tableName, columnName]
    );

    return result.rowCount > 0;
}

async function ensureHashedEmails(pool) {
    const hasEmailColumn = await columnExists(pool, "users", "email");
    const hasEmailHashColumn = await columnExists(pool, "users", "email_hash");

    if (!hasEmailColumn && !hasEmailHashColumn) {
        return;
    }

    if (!hasEmailHashColumn) {
        await pool.query("ALTER TABLE users ADD COLUMN email_hash VARCHAR(255)");
    }

    const selectFields = hasEmailColumn
        ? "id, email, email_hash"
        : "id, email_hash";
    const rows = (await pool.query(`SELECT ${selectFields} FROM users`)).rows;

    for (const row of rows) {
        const sourceValue = row.email || row.email_hash;
        const nextHash = sourceValue ? getEmailHash(sourceValue) : null;

        if (!nextHash) {
            continue;
        }

        if (hasEmailColumn) {
            await pool.query(
                "UPDATE users SET email_hash = $1, email = $1 WHERE id = $2",
                [nextHash, row.id]
            );
        } else if (!row.email_hash) {
            await pool.query(
                "UPDATE users SET email_hash = $1 WHERE id = $2",
                [nextHash, row.id]
            );
        }
    }

    await pool.query("ALTER TABLE users ALTER COLUMN email_hash SET NOT NULL");
}

async function syncSchema(pool) {
    const schema = readSchema();
    const schemaHash = getSchemaHash(schema);
    const schemaName = "public";

    await ensureMetadataTable(pool);

    const storedHash = await readStoredHash(pool, schemaName);
    const shouldReset = storedHash !== schemaHash;

    if (shouldReset) {
        await resetPublicSchema(pool);
        await applySchema(pool, schema);
        await writeStoredHash(pool, schemaName, schemaHash);
    }

    await ensureHashedEmails(pool);

    return {
        shouldReset,
        schemaHash
    };
}

module.exports = {
    syncSchema
};
