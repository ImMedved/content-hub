/*
Role repository
- role queries
*/

const db = require("../db/db");

// get role id by name
async function getRoleByName(name) {
    const [rows] = await db.query(
        "SELECT * FROM role WHERE name = ?",
        [name]
    );

    return rows[0];
}

// assign role
async function assignRole(userId, roleId) {
    await db.query(
        "INSERT INTO users_role (user_id, role_id) VALUES (?, ?)",
        [userId, roleId]
    );
}

module.exports = {
    getRoleByName,
    assignRole
};
