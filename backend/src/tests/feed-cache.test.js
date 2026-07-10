/*
Feed cache tests
- redis cache works with feed
*/

const request = require("supertest");
const app = require("../app");
const redisClient = require("../config/redis");
const { apiPath, responseData, responseToken } = require("./helpers/api");

let token1;
let token2;

beforeEach(async () => {
    await request(app).post(apiPath("/auth/register")).send({
        username: "cache_u1",
        email: "cache_u1@test.com",
        password: "123456"
    });

    const login1 = await request(app).post(apiPath("/auth/login")).send({
        email: "cache_u1@test.com",
        password: "123456"
    });

    token1 = responseToken(login1);

    await request(app).post(apiPath("/auth/register")).send({
        username: "cache_u2",
        email: "cache_u2@test.com",
        password: "123456"
    });

    const login2 = await request(app).post(apiPath("/auth/login")).send({
        email: "cache_u2@test.com",
        password: "123456"
    });

    token2 = responseToken(login2);

    const authorRes = await request(app)
        .get(apiPath("/users/me"))
        .set("Authorization", `Bearer ${token2}`);
    const authorId = responseData(authorRes).id;

    await request(app)
        .post(apiPath(`/follow/${authorId}`))
        .set("Authorization", `Bearer ${token1}`);
});

describe("Feed cache integration", () => {
    it("should return feed and use redis without errors", async () => {
        const first = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${token1}`);

        expect(first.statusCode).toBe(200);

        const second = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${token1}`);

        expect(second.statusCode).toBe(200);
        expect(Array.isArray(second.body.data)).toBe(true);
    });

    it("should invalidate feed cache after new post", async () => {
        await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token2}`)
            .send({
                title: "cached post",
                description: "desc",
                content: [{ type: "text", value: "hello cache" }],
                access: { type: "free" }
            });

        const res = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${token1}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
    });
});
