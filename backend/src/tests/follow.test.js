const request = require("supertest");
const app = require("../app");
const { apiPath, responseData, responseToken } = require("./helpers/api");

let followerToken;
let authorId;

beforeEach(async () => {
    await request(app).post(apiPath("/auth/register")).send({
        username: "follow_follower",
        email: "follow_follower@test.com",
        password: "123456"
    });

    await request(app).post(apiPath("/auth/register")).send({
        username: "follow_author",
        email: "follow_author@test.com",
        password: "123456"
    });

    const followerLogin = await request(app).post(apiPath("/auth/login")).send({
        email: "follow_follower@test.com",
        password: "123456"
    });

    const authorLogin = await request(app).post(apiPath("/auth/login")).send({
        email: "follow_author@test.com",
        password: "123456"
    });

    followerToken = responseToken(followerLogin);

    const meRes = await request(app)
        .get(apiPath("/users/me"))
        .set("Authorization", `Bearer ${responseToken(authorLogin)}`);

    authorId = responseData(meRes).id;
});

describe("Follow API", () => {
    it("should follow and unfollow another user", async () => {
        const followRes = await request(app)
            .post(apiPath(`/follow/${authorId}`))
            .set("Authorization", `Bearer ${followerToken}`);

        expect(followRes.statusCode).toBe(200);
        expect(responseData(followRes)).toBe(true);

        const followingRes = await request(app)
            .get(apiPath("/users/me/following"))
            .set("Authorization", `Bearer ${followerToken}`);

        expect(followingRes.statusCode).toBe(200);
        expect(responseData(followingRes).some((user) => user.id === authorId)).toBe(true);

        const followersRes = await request(app).get(apiPath(`/users/${authorId}/followers`));

        expect(followersRes.statusCode).toBe(200);
        expect(Array.isArray(responseData(followersRes))).toBe(true);
        expect(responseData(followersRes)).toHaveLength(1);

        const unfollowRes = await request(app)
            .delete(apiPath(`/follow/${authorId}`))
            .set("Authorization", `Bearer ${followerToken}`);

        expect(unfollowRes.statusCode).toBe(200);
        expect(responseData(unfollowRes)).toBe(true);
    });

    it("should reject following yourself", async () => {
        const meRes = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${followerToken}`);

        const res = await request(app)
            .post(apiPath(`/follow/${responseData(meRes).id}`))
            .set("Authorization", `Bearer ${followerToken}`);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/cannot follow yourself/i);
    });

    it("should reject duplicate follow", async () => {
        await request(app)
            .post(apiPath(`/follow/${authorId}`))
            .set("Authorization", `Bearer ${followerToken}`);

        const res = await request(app)
            .post(apiPath(`/follow/${authorId}`))
            .set("Authorization", `Bearer ${followerToken}`);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/already following/i);
    });

    it("should reject unfollow when relation does not exist", async () => {
        const res = await request(app)
            .delete(apiPath(`/follow/${authorId}`))
            .set("Authorization", `Bearer ${followerToken}`);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/not following/i);
    });
});
