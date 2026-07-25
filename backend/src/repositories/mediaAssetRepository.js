const db = require("../db/db");

async function getMediaAssetForPlayback(mediaId, viewerId) {
    const [[asset]] = await db.query(
        `SELECT
            ma.*,
            COALESCE(pa.access_type, 'free') AS access_type,
            p.author_id AS post_author_id,
            CASE WHEN ag.user_id IS NULL THEN false ELSE true END AS has_access_grant
         FROM media_asset ma
         LEFT JOIN post p ON p.id = ma.post_id
         LEFT JOIN post_access pa ON pa.post_id = ma.post_id
         LEFT JOIN access_grant ag ON ag.post_id = ma.post_id AND ag.user_id = ?
         WHERE ma.id = ?`,
        [viewerId || null, mediaId]
    );

    return asset || null;
}

async function getLatestMasterRevision(mediaId) {
    const [[revision]] = await db.query(
        `SELECT *
         FROM media_master_revision
         WHERE media_id = ?
         ORDER BY revision DESC
         LIMIT 1`,
        [mediaId]
    );

    return revision || null;
}

async function getMediaAssetById(mediaId) {
    const [[asset]] = await db.query(
        "SELECT * FROM media_asset WHERE id = ?",
        [mediaId]
    );

    return asset || null;
}

module.exports = {
    getLatestMasterRevision,
    getMediaAssetById,
    getMediaAssetForPlayback
};
