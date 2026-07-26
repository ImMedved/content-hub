const db = require("../db/db");

const MESSAGE_SELECT = `
    SELECT
        dm.id,
        dm.sender_id,
        dm.recipient_id,
        dm.body,
        dm.message_kind,
        dm.media_asset_id,
        dm.created_at,
        dm.read_at,
        sender.username AS sender_username,
        sender.display_name AS sender_display_name,
        sender.avatar_url AS sender_avatar_url,
        recipient.username AS recipient_username,
        recipient.display_name AS recipient_display_name,
        recipient.avatar_url AS recipient_avatar_url
    FROM direct_message dm
    JOIN users sender ON sender.id = dm.sender_id
    JOIN users recipient ON recipient.id = dm.recipient_id
`;

function mapMessage(row) {
    return {
        id: row.id,
        sender_id: row.sender_id,
        recipient_id: row.recipient_id,
        body: row.body,
        message_kind: row.message_kind || "text",
        media_asset_id: row.media_asset_id || null,
        created_at: row.created_at,
        read_at: row.read_at,
        sender: {
            id: row.sender_id,
            username: row.sender_username,
            display_name: row.sender_display_name,
            avatar_url: row.sender_avatar_url
        },
        recipient: {
            id: row.recipient_id,
            username: row.recipient_username,
            display_name: row.recipient_display_name,
            avatar_url: row.recipient_avatar_url
        }
    };
}

async function createMessage(senderId, recipientId, body) {
    const [result] = await db.query(
        "INSERT INTO direct_message (sender_id, recipient_id, body) VALUES (?, ?, ?) RETURNING id",
        [senderId, recipientId, body]
    );

    return findById(result.insertId);
}

async function createMediaMessage(senderId, recipientId, data) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [messageResult] = await connection.query(
            `INSERT INTO direct_message (sender_id, recipient_id, body, message_kind)
             VALUES (?, ?, ?, ?) RETURNING id`,
            [senderId, recipientId, data.body || "", data.mediaType]
        );
        const messageId = messageResult.insertId;

        const [mediaRows] = await connection.query(
            `WITH inserted AS (
                INSERT INTO media_asset (
                    message_id,
                    owner_id,
                    media_type,
                    original_url,
                    original_storage_key,
                    hls_storage_prefix,
                    status
                 ) VALUES (?, ?, ?, ?, ?, ?, 'uploaded') RETURNING id
             )
             SELECT id FROM inserted`,
            [
                messageId,
                senderId,
                data.mediaType,
                data.originalUrl,
                data.originalStorageKey,
                data.hlsStoragePrefix
            ]
        );
        const mediaId = mediaRows[0]?.id;
        const jobType = data.mediaType === "audio" ? "AUDIO_HLS_TRANSCODE" : "VIDEO_HLS_TRANSCODE";
        const priority = data.mediaType === "audio" ? 880 : 900;

        await connection.query(
            "UPDATE direct_message SET media_asset_id = ? WHERE id = ?",
            [mediaId, messageId]
        );

        await connection.query(
            `INSERT INTO media_job (media_id, type, status, priority)
             VALUES (?, ?, 'queued', ?)`,
            [mediaId, jobType, priority]
        );

        await connection.commit();
        return { messageId, mediaId };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function findById(messageId) {
    const [rows] = await db.query(
        `${MESSAGE_SELECT} WHERE dm.id = ?`,
        [messageId]
    );

    return rows[0] ? mapMessage(rows[0]) : null;
}

async function getConversationMessages(userId, peerId) {
    const [rows] = await db.query(
        `${MESSAGE_SELECT}
         WHERE (dm.sender_id = ? AND dm.recipient_id = ?)
            OR (dm.sender_id = ? AND dm.recipient_id = ?)
         ORDER BY dm.id ASC`,
        [userId, peerId, peerId, userId]
    );

    return rows.map(mapMessage);
}

async function markConversationRead(userId, peerId) {
    await db.query(
        `UPDATE direct_message
         SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL`,
        [userId, peerId]
    );
}

async function getChats(userId) {
    const [rows] = await db.query(
        `SELECT
            latest.id,
            latest.body,
            latest.message_kind,
            latest.media_asset_id,
            latest.created_at,
            latest.sender_id,
            latest.recipient_id,
            peer.id AS peer_id,
            peer.username AS peer_username,
            peer.display_name AS peer_display_name,
            peer.avatar_url AS peer_avatar_url,
            (
                SELECT COUNT(*)
                FROM direct_message unread
                WHERE unread.sender_id = peer.id
                  AND unread.recipient_id = ?
                  AND unread.read_at IS NULL
            ) AS unread_count
        FROM direct_message latest
        JOIN (
            SELECT
                CASE
                    WHEN sender_id = ? THEN recipient_id
                    ELSE sender_id
                END AS peer_id,
                MAX(id) AS last_message_id
            FROM direct_message
            WHERE sender_id = ? OR recipient_id = ?
            GROUP BY peer_id
        ) conversations ON conversations.last_message_id = latest.id
        JOIN users peer ON peer.id = conversations.peer_id
        ORDER BY latest.created_at DESC, latest.id DESC`,
        [userId, userId, userId, userId]
    );

    return rows.map((row) => ({
        peer: {
            id: row.peer_id,
            username: row.peer_username,
            display_name: row.peer_display_name,
            avatar_url: row.peer_avatar_url
        },
        last_message: {
            id: row.id,
            body: row.body,
            message_kind: row.message_kind || "text",
            media_asset_id: row.media_asset_id || null,
            sender_id: row.sender_id,
            recipient_id: row.recipient_id,
            created_at: row.created_at
        },
        unread_count: Number(row.unread_count || 0)
    }));
}

async function hasConversation(userId, peerId) {
    const [rows] = await db.query(
        `SELECT 1
         FROM direct_message
         WHERE (sender_id = ? AND recipient_id = ?)
            OR (sender_id = ? AND recipient_id = ?)
         LIMIT 1`,
        [userId, peerId, peerId, userId]
    );

    return rows.length > 0;
}

async function getMessagesSince(userId, afterId) {
    const [rows] = await db.query(
        `${MESSAGE_SELECT}
         WHERE (dm.sender_id = ? OR dm.recipient_id = ?)
           AND dm.id > ?
         ORDER BY dm.id ASC`,
        [userId, userId, afterId]
    );

    return rows.map(mapMessage);
}

module.exports = {
    createMessage,
    createMediaMessage,
    findById,
    getConversationMessages,
    markConversationRead,
    getChats,
    hasConversation,
    getMessagesSince
};
