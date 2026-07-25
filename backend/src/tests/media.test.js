const request = require("supertest");
const app = require("../app");
const db = require("../db/db");
const { apiPath, responseData, responseToken } = require("./helpers/api");

async function registerAndLogin(username, email) {
    await request(app).post(apiPath("/auth/register")).send({
        username,
        email,
        password: "123456"
    });

    const loginRes = await request(app).post(apiPath("/auth/login")).send({
        email,
        password: "123456"
    });

    return responseToken(loginRes);
}

async function getCurrentUserId(token) {
    const res = await request(app)
        .get(apiPath("/users/me"))
        .set("Authorization", `Bearer ${token}`);

    return responseData(res).id;
}

async function createPost(token, access = { type: "free" }) {
    const res = await request(app)
        .post(apiPath("/posts"))
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "video post",
            description: "hls",
            content: [{ type: "video", value: "hls:pending" }],
            access
        });

    return responseData(res).postId;
}

async function createPlayableMedia({ postId, ownerId }) {
    const [rows] = await db.query(
        `WITH inserted AS (
            INSERT INTO media_asset (
                post_id,
                owner_id,
                original_url,
                original_storage_key,
                hls_storage_prefix,
                poster_url,
                status,
                playable_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'playable', NOW())
            RETURNING id
        )
        SELECT id FROM inserted`,
        [
            postId,
            ownerId,
            "/api/v1/media/originals/video.mp4",
            "originals/video.mp4",
            "media/test-video",
            "/api/v1/media/posters/video.jpg"
        ]
    );
    const mediaId = rows[0].id;

    await db.query(
        `INSERT INTO media_master_revision (media_id, revision, playlist_storage_key)
         VALUES (?, 1, 'master/revision_1.m3u8')`,
        [mediaId]
    );

    return mediaId;
}

describe("Media playback API", () => {
    it("should create playback session for playable free media", async () => {
        const token = await registerAndLogin("video_owner", "video-owner@test.com");
        const ownerId = await getCurrentUserId(token);
        const postId = await createPost(token);
        const mediaId = await createPlayableMedia({ postId, ownerId });

        const res = await request(app)
            .post(apiPath(`/media/${mediaId}/playback-session`))
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(responseData(res).manifestUrl).toBe(`/api/v1/media/playback/${mediaId}/master/revision_1.m3u8`);
        expect(responseData(res).status).toBe("playable");
        expect(res.headers["set-cookie"]?.join(";")).toMatch(/media_session=/);
    });

    it("should reject playback session for locked paid media", async () => {
        const ownerToken = await registerAndLogin("paid_owner", "paid-owner@test.com");
        const viewerToken = await registerAndLogin("paid_viewer", "paid-viewer@test.com");
        const ownerId = await getCurrentUserId(ownerToken);
        const postId = await createPost(ownerToken, { type: "paid", price: 25 });
        const mediaId = await createPlayableMedia({ postId, ownerId });

        const res = await request(app)
            .post(apiPath(`/media/${mediaId}/playback-session`))
            .set("Authorization", `Bearer ${viewerToken}`);

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toMatch(/access/i);
    });
});
