/*
Comment repository
- create comment
- get comments
- delete comment
*/

const db = require("../db/db");

async function createComment(postId, userId, content) {
    const [res] = await db.query(
        "INSERT INTO comment (post_id, author_id, content) VALUES (?, ?, ?) RETURNING id",
        [postId, userId, content]
    );

    return res.insertId;
}

async function getComments(postId) {
    const query = [
        "SELECT",
        "    c.*,",
        "    u.username AS author_username,",
        "    u.display_name AS authorName,",
        "    u.avatar_url AS author_avatar_url",
        "FROM comment c",
        "INNER JOIN users u ON u.id = c.author_id",
        "WHERE c.post_id = ?",
        "ORDER BY c.created_at ASC"
    ].join(" ");

    const [rows] = await db.query(query, [postId]);

    return rows;
}

async function deleteComment(commentId, userId) {
    const [result] = await db.query(
        `DELETE FROM comment
         WHERE id = ?
           AND EXISTS (
               SELECT 1
               FROM post p
               WHERE p.id = comment.post_id
                 AND (comment.author_id = ? OR p.author_id = ?)
           )`,
        [commentId, userId, userId]
    );

    return result.affectedRows;
}

async function updateComment(commentId, userId, content) {
    const [result] = await db.query(
        "UPDATE comment SET content = ? WHERE id = ? AND author_id = ?",
        [content, commentId, userId]
    );

    return result.affectedRows;
}

module.exports = {
    createComment,
    getComments,
    deleteComment,
    updateComment
};
