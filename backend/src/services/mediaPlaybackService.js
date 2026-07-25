const jwt = require("jsonwebtoken");
const mediaRepo = require("../repositories/mediaAssetRepository");

const PLAYBACK_TTL_SECONDS = Number(process.env.MEDIA_PLAYBACK_TTL_SECONDS || 900);
const COOKIE_NAME = "media_session";

function getSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT secret is not configured");
    }

    return process.env.JWT_SECRET;
}

function isPlayableStatus(status) {
    return ["playable", "enhancing", "ready"].includes(String(status || "").toLowerCase());
}

function canViewerAccess(asset, viewerId) {
    if (!asset) {
        return false;
    }

    if (!asset.post_id) {
        return Number(asset.owner_id) === Number(viewerId);
    }

    if (Number(asset.post_author_id) === Number(viewerId)) {
        return true;
    }

    if (String(asset.access_type || "free").toLowerCase() !== "paid") {
        return true;
    }

    return Boolean(asset.has_access_grant);
}

function signPlaybackToken({ viewerId, mediaId }) {
    return jwt.sign(
        {
            sub: String(viewerId),
            media: String(mediaId),
            scope: "media:play"
        },
        getSecret(),
        { expiresIn: PLAYBACK_TTL_SECONDS }
    );
}

function verifyPlaybackToken(token, mediaId) {
    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, getSecret());
        if (
            decoded?.scope !== "media:play" ||
            String(decoded.media) !== String(mediaId)
        ) {
            return null;
        }

        return decoded;
    } catch (err) {
        return null;
    }
}

async function createPlaybackSession(mediaId, viewerId) {
    const asset = await mediaRepo.getMediaAssetForPlayback(mediaId, viewerId);

    if (!asset) {
        throw new Error("Media asset not found");
    }

    if (!canViewerAccess(asset, viewerId)) {
        throw new Error("You do not have access to this media");
    }

    if (!isPlayableStatus(asset.status)) {
        return {
            mediaId: String(asset.id),
            status: asset.status,
            manifestUrl: null,
            posterUrl: asset.poster_url || null,
            expiresAt: null
        };
    }

    const latestRevision = await mediaRepo.getLatestMasterRevision(mediaId);
    const manifestPath = latestRevision?.playlist_storage_key || "master/revision_1.m3u8";
    const token = signPlaybackToken({ viewerId, mediaId });
    const expiresAt = new Date(Date.now() + PLAYBACK_TTL_SECONDS * 1000).toISOString();

    return {
        cookie: {
            name: COOKIE_NAME,
            value: token,
            maxAge: PLAYBACK_TTL_SECONDS
        },
        payload: {
            mediaId: String(asset.id),
            status: asset.status,
            manifestUrl: `/api/v1/media/playback/${asset.id}/${manifestPath}`,
            posterUrl: asset.poster_url || null,
            expiresAt
        }
    };
}

function parseCookies(header) {
    return String(header || "")
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .reduce((cookies, item) => {
            const separatorIndex = item.indexOf("=");
            if (separatorIndex === -1) {
                return cookies;
            }

            const key = item.slice(0, separatorIndex);
            const value = item.slice(separatorIndex + 1);
            cookies[key] = decodeURIComponent(value);
            return cookies;
        }, {});
}

async function authorizePlaybackRequest(mediaId, cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const token = cookies[COOKIE_NAME];
    const decoded = verifyPlaybackToken(token, mediaId);

    if (!decoded) {
        throw new Error("Invalid playback session");
    }

    const asset = await mediaRepo.getMediaAssetById(mediaId);

    if (!asset || !isPlayableStatus(asset.status)) {
        throw new Error("Media is not playable");
    }

    return asset;
}

module.exports = {
    authorizePlaybackRequest,
    createPlaybackSession
};
