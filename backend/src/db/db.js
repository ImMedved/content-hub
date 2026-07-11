const { Pool, types } = require("pg");
require("dotenv").config({
    path: process.env.NODE_ENV === "test" ? ".env.test" : ".env"
});

const { formatValuePlaceholders } = require("./postgres/queryFormatter");
const { normalizeRows, buildCommandResult } = require("./postgres/resultAdapter");
const { syncSchema } = require("./postgres/schemaSync");

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10
});

function shouldReturnRows(sql) {
    return /^\s*(select|with)\b/i.test(sql);
}

async function execute(client, sql, params = []) {
    const formattedSql = formatValuePlaceholders(sql);
    const result = await client.query(formattedSql, params);

    if (shouldReturnRows(sql)) {
        return [normalizeRows(result.rows), result];
    }

    return [buildCommandResult(result), result];
}

async function query(sql, params = []) {
    return execute(pool, sql, params);
}

async function getConnection() {
    const client = await pool.connect();

    return {
        query(sql, params = []) {
            return execute(client, sql, params);
        },
        beginTransaction() {
            return client.query("BEGIN");
        },
        commit() {
            return client.query("COMMIT");
        },
        rollback() {
            return client.query("ROLLBACK");
        },
        release() {
            client.release();
        }
    };
}

async function createSchema() {
    return syncSchema(pool);
}

module.exports = {
    query,
    getConnection,
    createSchema,
    end: () => pool.end()
};
