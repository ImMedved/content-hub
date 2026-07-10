/*
User tests
- protected route
*/

const request = require("supertest");
const app = require("../app");
const { apiPath, responseData, responseToken } = require("./helpers/api");

let token;
let userId;

beforeEach(async () => {
    await request(app).post(apiPath("/auth/register")).send({
        username: "user1",
        email: "user1@test.com",
        password: "123456"
    });

    const res = await request(app).post(apiPath("/auth/login")).send({
        email: "user1@test.com",
        password: "123456"
    });

    token = responseToken(res);

    const meRes = await request(app)
        .get(apiPath("/users/me"))
        .set("Authorization", `Bearer ${token}`);

    userId = responseData(meRes).id;
});

describe("User API", () => {

    it("should return current user", async () => {
        const res = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(responseData(res).id).toBeDefined();
        expect(Array.isArray(responseData(res).posts)).toBe(true);
        expect(responseData(res).wallet_balance).toBe(100);
    });

    it("should return user profile by id", async () => {
        const res = await request(app).get(apiPath(`/users/${userId}`));

        expect(res.statusCode).toBe(200);
        expect(responseData(res).id).toBe(userId);
        expect(Array.isArray(responseData(res).posts)).toBe(true);
    });

    it("should return following list for current user", async () => {
        const res = await request(app)
            .get(apiPath("/users/me/following"))
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(responseData(res))).toBe(true);
    });

    it("should return follower list for current user", async () => {
        const res = await request(app)
            .get(apiPath("/users/me/followers"))
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(responseData(res))).toBe(true);
    });

    it("should return public following and followers lists by user id", async () => {
        const followingRes = await request(app).get(apiPath(`/users/${userId}/following`));
        const followersRes = await request(app).get(apiPath(`/users/${userId}/followers`));

        expect(followingRes.statusCode).toBe(200);
        expect(Array.isArray(responseData(followingRes))).toBe(true);

        expect(followersRes.statusCode).toBe(200);
        expect(Array.isArray(responseData(followersRes))).toBe(true);
    });

    it("should update current user profile", async () => {
        const res = await request(app)
            .put(apiPath("/users/me"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                display_name: "Updated User",
                bio: "Updated bio",
                status: "creator",
                avatar_url: "https://example.com/avatar.png"
            });

        expect(res.statusCode).toBe(200);
        expect(responseData(res).display_name).toBe("Updated User");
        expect(responseData(res).bio).toBe("Updated bio");
        expect(responseData(res).status).toBe("creator");
        expect(responseData(res).avatar_url).toBe("https://example.com/avatar.png");
    });

});
