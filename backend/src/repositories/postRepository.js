/*
Post repository
- create post
- get post
- list posts
*/

const db = require("../db/db");

async function createPost(authorId, title, description, previewUrl = null) {
    const [res] = await db.query(
        "INSERT INTO post (author_id, title, description, preview_url, status) VALUES (?, ?, ?, ?, ?) RETURNING id",
        [authorId, title, description, previewUrl, "published"]
    );

    return res.insertId;
}

async function createImagePost(authorId, imageData) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [res] = await connection.query(
            `INSERT INTO post (author_id, post_kind, title, description, preview_url, status)
             VALUES (?, 'image', ?, ?, ?, ?) RETURNING id`,
            [
                authorId,
                imageData.title,
                imageData.description || "",
                imageData.feedThumbnailUrl || imageData.thumbnailUrl || null,
                "published"
            ]
        );
        const postId = res.insertId;

        await connection.query(
            `INSERT INTO post_content (post_id, content_type, content_url, text_content)
             VALUES (?, 'image', ?, NULL)`,
            [postId, imageData.compressedUrl || null]
        );

        await connection.query(
            `INSERT INTO image_asset (
                post_id,
                owner_id,
                original_url,
                compressed_url,
                thumbnail_url,
                feed_thumbnail_url,
                original_storage_key,
                compressed_storage_key,
                thumbnail_storage_key,
                feed_thumbnail_storage_key,
                processing_status,
                analysis_status,
                analysis_payload,
                ocr_text,
                caption
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)`,
            [
                postId,
                authorId,
                imageData.originalUrl,
                imageData.compressedUrl || null,
                imageData.thumbnailUrl || null,
                imageData.feedThumbnailUrl || null,
                imageData.originalStorageKey || null,
                imageData.compressedStorageKey || null,
                imageData.thumbnailStorageKey || null,
                imageData.feedThumbnailStorageKey || null,
                imageData.processingStatus || "queued",
                imageData.analysisStatus || "pending",
                imageData.analysisPayload ? JSON.stringify(imageData.analysisPayload) : null,
                imageData.ocrText || null,
                imageData.caption || null
            ]
        );

        await connection.query(
            "INSERT INTO post_access (post_id, access_type, price) VALUES (?, 'free', 0)",
            [postId]
        );

        await connection.commit();
        return postId;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function createVideoPost(authorId, videoData) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [postResult] = await connection.query(
            `INSERT INTO post (author_id, post_kind, title, description, preview_url, status)
             VALUES (?, 'video', ?, ?, NULL, ?) RETURNING id`,
            [
                authorId,
                videoData.title,
                videoData.description || "",
                "published"
            ]
        );
        const postId = postResult.insertId;

        const [mediaRows] = await connection.query(
            `WITH inserted AS (
                INSERT INTO media_asset (
                    post_id,
                    owner_id,
                    original_url,
                    original_storage_key,
                    hls_storage_prefix,
                    status
                 ) VALUES (?, ?, ?, ?, ?, 'uploaded') RETURNING id
             )
             SELECT id FROM inserted`,
            [
                postId,
                authorId,
                videoData.originalUrl,
                videoData.originalStorageKey,
                videoData.hlsStoragePrefix
            ]
        );
        const mediaId = mediaRows[0]?.id;

        await connection.query(
            `INSERT INTO media_job (media_id, type, status, priority)
             VALUES (?, 'VIDEO_HLS_TRANSCODE', 'queued', 900)`,
            [mediaId]
        );

        await connection.query(
            `INSERT INTO post_content (post_id, content_type, content_url, text_content)
             VALUES (?, 'video', ?, NULL)`,
            [postId, `hls:${mediaId}`]
        );

        await connection.query(
            "INSERT INTO post_access (post_id, access_type, price) VALUES (?, ?, ?)",
            [postId, videoData.access.type, videoData.access.price || 0]
        );

        await connection.commit();
        return { postId, mediaId };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function getImageAssetByPostId(postId) {
    const [[row]] = await db.query(
        "SELECT * FROM image_asset WHERE post_id = ?",
        [postId]
    );

    return row || null;
}

async function updateImageAssetProcessing(postId, data) {
    const fields = [];
    const values = [];

    for (const [column, value] of Object.entries(data)) {
        if (typeof value === "undefined") {
            continue;
        }

        if (column === "analysis_payload") {
            fields.push(`${column} = ?::jsonb`);
            values.push(value ? JSON.stringify(value) : null);
        } else {
            fields.push(`${column} = ?`);
            values.push(value);
        }
    }

    if (fields.length === 0) {
        return 0;
    }

    values.push(postId);

    const [result] = await db.query(
        `UPDATE image_asset SET ${fields.join(", ")} WHERE post_id = ?`,
        values
    );

    return result.affectedRows;
}

async function updateImagePostMedia(postId, { contentUrl, previewUrl }) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        if (previewUrl) {
            await connection.query(
                "UPDATE post SET preview_url = ? WHERE id = ?",
                [previewUrl, postId]
            );
        }

        if (contentUrl) {
            await connection.query(
                "UPDATE post_content SET content_url = ? WHERE post_id = ? AND content_type = 'image'",
                [contentUrl, postId]
            );
        }

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function markVideoProcessingStarted(mediaId) {
    await db.query(
        "UPDATE media_asset SET status = 'processing_fast_version' WHERE id = ?",
        [mediaId]
    );
}

async function markVideoProcessingFailed(mediaId, errorMessage) {
    await db.query(
        `UPDATE media_asset
         SET status = 'failed'
         WHERE id = ?`,
        [mediaId]
    );

    await db.query(
        `INSERT INTO media_job (media_id, type, status, priority, attempt, error_message, finished_at)
         VALUES (?, 'VIDEO_HLS_TRANSCODE', 'failed', 900, 1, ?, NOW())
         ON CONFLICT (media_id, type)
         DO UPDATE SET status = 'failed', error_message = EXCLUDED.error_message, finished_at = NOW()`,
        [mediaId, String(errorMessage || "Video processing failed").slice(0, 2000)]
    );
}

async function markVideoPlayable(mediaId, result) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const posterUrl = result.posterKey ? `/api/v1/media/${encodeURIComponent(result.posterKey)}` : null;
        const mediaRows = await connection.query(
            `UPDATE media_asset
             SET status = 'playable',
                 hls_storage_prefix = ?,
                 poster_url = ?,
                 duration_seconds = ?,
                 source_width = ?,
                 source_height = ?,
                 source_fps = ?,
                 has_audio = ?,
                 playable_at = NOW(),
                 ready_at = NOW()
             WHERE id = ?
             RETURNING post_id`,
            [
                result.hlsPrefix,
                posterUrl,
                result.probe?.duration || null,
                result.probe?.width || null,
                result.probe?.height || null,
                result.probe?.fps || null,
                Boolean(result.probe?.hasAudio),
                mediaId
            ]
        );
        const postId = mediaRows[0][0]?.post_id;

        await connection.query(
            `INSERT INTO media_master_revision (media_id, revision, playlist_storage_key)
             VALUES (?, 1, 'master/revision_1.m3u8')
             ON CONFLICT (media_id, revision)
             DO UPDATE SET playlist_storage_key = EXCLUDED.playlist_storage_key, published_at = NOW()`,
            [mediaId]
        );

        for (const rendition of result.renditions || []) {
            await connection.query(
                `INSERT INTO media_rendition (
                    media_id,
                    label,
                    width,
                    height,
                    bitrate_kbps,
                    crf,
                    playlist_storage_key,
                    status
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ready')
                 ON CONFLICT (media_id, label)
                 DO UPDATE SET
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    bitrate_kbps = EXCLUDED.bitrate_kbps,
                    crf = EXCLUDED.crf,
                    playlist_storage_key = EXCLUDED.playlist_storage_key,
                    status = 'ready'`,
                [
                    mediaId,
                    rendition.label,
                    rendition.width,
                    rendition.height,
                    rendition.bitrate,
                    rendition.crf,
                    `video/${rendition.label}/r1/index.m3u8`
                ]
            );
        }

        await connection.query(
            `INSERT INTO media_job (media_id, type, status, priority, attempt, progress_percent, finished_at)
             VALUES (?, 'VIDEO_HLS_TRANSCODE', 'finished', 900, 1, 100, NOW())
             ON CONFLICT (media_id, type)
             DO UPDATE SET status = 'finished', progress_percent = 100, finished_at = NOW()`,
            [mediaId]
        );

        if (postId && posterUrl) {
            await connection.query(
                "UPDATE post SET preview_url = ? WHERE id = ?",
                [posterUrl, postId]
            );
        }

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function clearPinnedForAuthor(authorId, exceptPostId = null) {
    const params = [authorId];
    let query = "UPDATE post SET is_pinned = 0 WHERE author_id = ?";

    if (exceptPostId) {
        query += " AND id <> ?";
        params.push(exceptPostId);
    }

    await db.query(query, params);
}

async function updatePost(postId, authorId, title, description, previewUrl = null) {
    const [result] = await db.query(
        `UPDATE post
         SET title = ?, description = ?, preview_url = ?
         WHERE id = ? AND author_id = ?`,
        [title, description, previewUrl, postId, authorId]
    );

    return result.affectedRows;
}

async function addContent(postId, content) {
    for (const item of content) {
        await db.query(
            "INSERT INTO post_content (post_id, content_type, content_url, text_content) VALUES (?, ?, ?, ?)",
            [
                postId,
                item.type,
                item.type === "text" ? null : item.value,
                item.type === "text" ? item.value : null
            ]
        );
    }
}

async function replaceContent(postId, content) {
    await db.query("DELETE FROM post_content WHERE post_id = ?", [postId]);

    if (Array.isArray(content) && content.length > 0) {
        await addContent(postId, content);
    }
}

async function setAccess(postId, access) {
    await db.query(
        "INSERT INTO post_access (post_id, access_type, price) VALUES (?, ?, ?)",
        [postId, access.type, access.price || 0]
    );
}

async function updateAccess(postId, access) {
    const [result] = await db.query(
        "UPDATE post_access SET access_type = ?, price = ? WHERE post_id = ?",
        [access.type, access.price || 0, postId]
    );

    if (result.affectedRows === 0) {
        await setAccess(postId, access);
    }
}

async function syncTags(postId, tags) {
    await db.query("DELETE FROM post_tag WHERE post_id = ?", [postId]);

    if (!Array.isArray(tags) || tags.length === 0) {
        return;
    }

    for (const rawTag of tags) {
        const normalizedTag = String(rawTag || "").trim().toLowerCase();

        if (!normalizedTag) {
            continue;
        }

        const [insertedTags] = await db.query(
            "INSERT INTO tag (name) VALUES (?) ON CONFLICT (name) DO NOTHING RETURNING id",
            [normalizedTag]
        );

        let tag = insertedTags[0];

        if (!tag) {
            const [existingTags] = await db.query(
                "SELECT id FROM tag WHERE name = ?",
                [normalizedTag]
            );
            tag = existingTags[0];
        }

        await db.query(
            "INSERT INTO post_tag (post_id, tag_id) VALUES (?, ?) ON CONFLICT (post_id, tag_id) DO NOTHING",
            [postId, tag.id]
        );
    }
}

async function getPostById(id) {
    const [[post]] = await db.query(
        `SELECT
            p.*,
            u.username AS author_username,
            u.display_name AS authorName,
            u.avatar_url AS author_avatar_url
        FROM post p
        INNER JOIN users u ON u.id = p.author_id
        WHERE p.id = ?`,
        [id]
    );

    const [content] = await db.query(
        "SELECT * FROM post_content WHERE post_id = ? ORDER BY created_at ASC",
        [id]
    );

    const [[access]] = await db.query(
        "SELECT * FROM post_access WHERE post_id = ?",
        [id]
    );

    return { post, content, access };
}

async function getPostAccessMap(postIds) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return new Map();
    }

    const placeholders = postIds.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT post_id, access_type, price FROM post_access WHERE post_id IN (${placeholders})`,
        postIds
    );

    return new Map(rows.map((row) => [Number(row.post_id), row]));
}

async function getPostContentMap(postIds) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return new Map();
    }

    const placeholders = postIds.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT id, post_id, content_type, content_url, text_content
         FROM post_content
         WHERE post_id IN (${placeholders})
         ORDER BY created_at ASC`,
        postIds
    );

    const map = new Map();

    for (const row of rows) {
        const postId = Number(row.post_id);
        const items = map.get(postId) || [];
        items.push(row);
        map.set(postId, items);
    }

    return map;
}

async function getImageAssetMap(postIds) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return new Map();
    }

    const placeholders = postIds.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT *
         FROM image_asset
         WHERE post_id IN (${placeholders})`,
        postIds
    );

    return new Map(rows.map((row) => [Number(row.post_id), row]));
}

async function getPostTagMap(postIds) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return new Map();
    }

    const placeholders = postIds.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT pt.post_id, t.name
         FROM post_tag pt
         INNER JOIN tag t ON t.id = pt.tag_id
         WHERE pt.post_id IN (${placeholders})
         ORDER BY t.name ASC`,
        postIds
    );

    const map = new Map();

    for (const row of rows) {
        const postId = Number(row.post_id);
        const tags = map.get(postId) || [];
        tags.push(row.name);
        map.set(postId, tags);
    }

    return map;
}

function buildPostOrder(sort) {
    if (sort === "popular") {
        return "ORDER BY p.is_pinned DESC, COALESCE(reaction_summary.reaction_count, 0) DESC, p.created_at DESC";
    }

    if (sort === "expensive") {
        return "ORDER BY p.is_pinned DESC, COALESCE(pa.price, 0) DESC, p.created_at DESC";
    }

    return "ORDER BY p.is_pinned DESC, p.created_at DESC";
}

async function listPosts(
    limit = 20,
    offset = 0,
    authorId = null,
    authorQuery = null,
    tag = null,
    sort = "new",
    accessType = null,
    includeTags = [],
    excludeTags = [],
    postKind = null,
    followedByUserId = null
) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const safeOffset = Math.max(0, Number(offset) || 0);
    let query = `
        SELECT
            p.*,
            u.username AS author_username,
            u.display_name AS authorName,
            u.avatar_url AS author_avatar_url,
            COALESCE(pa.access_type, 'free') AS list_access_type,
            COALESCE(pa.price, 0) AS list_price,
            COALESCE(reaction_summary.reaction_count, 0) AS reaction_count
        FROM post p
        INNER JOIN users u ON u.id = p.author_id
        LEFT JOIN post_access pa ON pa.post_id = p.id
        LEFT JOIN (
            SELECT post_id, COUNT(*) AS reaction_count
            FROM reaction
            GROUP BY post_id
        ) reaction_summary ON reaction_summary.post_id = p.id
    `;
    const params = [];
    const conditions = [];

    if (tag) {
        conditions.push(`EXISTS (
            SELECT 1
            FROM post_tag pt
            INNER JOIN tag t ON t.id = pt.tag_id
            WHERE pt.post_id = p.id AND t.name = ?
        )`);
        params.push(String(tag).trim().toLowerCase());
    }

    for (const includeTag of includeTags) {
        conditions.push(`EXISTS (
            SELECT 1
            FROM post_tag pt
            INNER JOIN tag t ON t.id = pt.tag_id
            WHERE pt.post_id = p.id AND t.name = ?
        )`);
        params.push(String(includeTag).trim().toLowerCase());
    }

    for (const excludeTag of excludeTags) {
        conditions.push(`NOT EXISTS (
            SELECT 1
            FROM post_tag pt
            INNER JOIN tag t ON t.id = pt.tag_id
            WHERE pt.post_id = p.id AND t.name = ?
        )`);
        params.push(String(excludeTag).trim().toLowerCase());
    }

    if (authorId) {
        conditions.push("p.author_id = ?");
        params.push(authorId);
    }

    if (authorQuery) {
        conditions.push("(u.username LIKE ? OR u.display_name LIKE ?)");
        params.push(`%${String(authorQuery).trim()}%`, `%${String(authorQuery).trim()}%`);
    }

    if (accessType) {
        conditions.push("pa.access_type = ?");
        params.push(accessType);
    }

    if (postKind) {
        conditions.push("p.post_kind = ?");
        params.push(postKind);
    }

    if (followedByUserId) {
        conditions.push(`(
            p.author_id = ? OR EXISTS (
                SELECT 1
                FROM follow f
                WHERE f.following_id = p.author_id AND f.follower_id = ?
            )
        )`);
        params.push(followedByUserId, followedByUserId);
    }

    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ${buildPostOrder(sort)} LIMIT ? OFFSET ?`;
    params.push(safeLimit, safeOffset);

    const [rows] = await db.query(query, params);

    return rows;
}

async function getReactionCountMap(postIds) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return new Map();
    }

    const placeholders = postIds.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT post_id, COUNT(*) AS count
         FROM reaction
         WHERE post_id IN (${placeholders})
         GROUP BY post_id`,
        postIds
    );

    return new Map(rows.map((row) => [Number(row.post_id), Number(row.count || 0)]));
}

async function getCommentCountMap(postIds) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return new Map();
    }

    const placeholders = postIds.map(() => "?").join(", ");
    const [rows] = await db.query(
        `SELECT post_id, COUNT(*) AS count
         FROM comment
         WHERE post_id IN (${placeholders})
         GROUP BY post_id`,
        postIds
    );

    return new Map(rows.map((row) => [Number(row.post_id), Number(row.count || 0)]));
}

async function listImages({ limit = 40, offset = 0, authorId = null, followedByUserId = null } = {}) {
    return listPosts(
        limit,
        offset,
        authorId,
        null,
        null,
        "new",
        null,
        [],
        [],
        "image",
        followedByUserId
    );
}

async function listTags(query = "", limit = 8) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 20));

    if (!normalizedQuery) {
        const [rows] = await db.query(
            "SELECT name FROM tag ORDER BY name ASC LIMIT ?",
            [safeLimit]
        );
        return rows.map((row) => row.name);
    }

    const likeValue = `%${normalizedQuery}%`;
    const prefixValue = `${normalizedQuery}%`;
    const [rows] = await db.query(
        `SELECT name
         FROM tag
         WHERE name LIKE ?
         ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name ASC
         LIMIT ?`,
        [likeValue, prefixValue, safeLimit]
    );

    return rows.map((row) => row.name);
}

async function listAllTags() {
    const [rows] = await db.query(
        "SELECT name FROM tag ORDER BY name ASC"
    );

    return rows.map((row) => row.name);
}

async function getPostOwner(postId) {
    const [[row]] = await db.query(
        "SELECT id, author_id, title FROM post WHERE id = ?",
        [postId]
    );

    return row || null;
}

async function getReactionUsers(postId) {
    const [rows] = await db.query(
        `SELECT
            u.id,
            u.username,
            u.display_name,
            u.avatar_url,
            r.type,
            r.created_at
         FROM reaction r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.post_id = ?
         ORDER BY r.created_at DESC`,
        [postId]
    );

    return rows;
}

async function deletePost(postId, authorId) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [[post]] = await connection.query(
            "SELECT id FROM post WHERE id = ? AND author_id = ? FOR UPDATE",
            [postId, authorId]
        );

        if (!post) {
            await connection.rollback();
            return 0;
        }

        await connection.query("DELETE FROM access_grant WHERE post_id = ?", [postId]);
        await connection.query("DELETE FROM payment_transaction WHERE post_id = ?", [postId]);
        await connection.query("DELETE FROM reaction WHERE post_id = ?", [postId]);
        await connection.query("DELETE FROM comment WHERE post_id = ?", [postId]);
        await connection.query("DELETE FROM post_content WHERE post_id = ?", [postId]);
        await connection.query("DELETE FROM post_access WHERE post_id = ?", [postId]);
        await connection.query("DELETE FROM post_tag WHERE post_id = ?", [postId]);

        const [result] = await connection.query(
            "DELETE FROM post WHERE id = ? AND author_id = ?",
            [postId, authorId]
        );

        await connection.commit();
        return result.affectedRows;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function pinPost(postId, authorId) {
    const [result] = await db.query(
        "UPDATE post SET is_pinned = 1 WHERE id = ? AND author_id = ?",
        [postId, authorId]
    );

    return result.affectedRows;
}

module.exports = {
    createPost,
    createImagePost,
    createVideoPost,
    getImageAssetByPostId,
    updateImageAssetProcessing,
    updateImagePostMedia,
    markVideoPlayable,
    markVideoProcessingFailed,
    markVideoProcessingStarted,
    clearPinnedForAuthor,
    updatePost,
    addContent,
    replaceContent,
    setAccess,
    updateAccess,
    syncTags,
    getPostById,
    getPostAccessMap,
    getPostContentMap,
    getImageAssetMap,
    getPostTagMap,
    getReactionCountMap,
    getCommentCountMap,
    listPosts,
    listImages,
    listTags,
    listAllTags,
    getPostOwner,
    getReactionUsers,
    deletePost,
    pinPost
};
