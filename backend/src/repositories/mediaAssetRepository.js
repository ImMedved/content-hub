const db = require("../db/db");

async function getMediaAssetForPlayback(mediaId, viewerId) {
    const [[asset]] = await db.query(
        `SELECT
            ma.*,
            COALESCE(pa.access_type, 'free') AS access_type,
            p.author_id AS post_author_id,
            CASE WHEN ag.user_id IS NULL THEN false ELSE true END AS has_access_grant,
            latest_job.status AS latest_job_status,
            latest_job.error_code AS latest_job_error_code,
            latest_job.error_message AS latest_job_error_message
         FROM media_asset ma
         LEFT JOIN post p ON p.id = ma.post_id
         LEFT JOIN post_access pa ON pa.post_id = ma.post_id
         LEFT JOIN access_grant ag ON ag.post_id = ma.post_id AND ag.user_id = ?
         LEFT JOIN LATERAL (
            SELECT status, error_code, error_message
            FROM media_job
            WHERE media_id = ma.id
            ORDER BY created_at DESC
            LIMIT 1
         ) latest_job ON true
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
