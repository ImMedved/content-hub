/*
Feed tests
*/

const request = require("supertest");
const app = require("../app");
const { apiPath, responseData, responseToken } = require("./helpers/api");

let token1;
let token2;

beforeEach(async () => {
    // user1
    await request(app).post(apiPath("/auth/register")).send({
        username: "u1",
        email: "u1@test.com",
        password: "123456"
    });

    const res1 = await request(app).post(apiPath("/auth/login")).send({
        email: "u1@test.com",
        password: "123456"
    });

    token1 = responseToken(res1);

    // user2
    await request(app).post(apiPath("/auth/register")).send({
        username: "u2",
        email: "u2@test.com",
        password: "123456"
    });

    const res2 = await request(app).post(apiPath("/auth/login")).send({
        email: "u2@test.com",
        password: "123456"
    });

    token2 = responseToken(res2);

    const authorRes = await request(app)
        .get(apiPath("/users/me"))
        .set("Authorization", `Bearer ${token2}`);
    const authorId = responseData(authorRes).id;

    // user2 creates post
    await request(app)
        .post(apiPath("/posts"))
        .set("Authorization", `Bearer ${token2}`)
        .send({
            title: "post from u2",
            content: [{ type: "text", value: "hello" }]
        });

    // user1 follows user2
    await request(app)
        .post(apiPath(`/follow/${authorId}`))
        .set("Authorization", `Bearer ${token1}`);
});

describe("Feed API", () => {

    it("should return feed posts", async () => {
        const res = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${token1}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0].author_username).toBeDefined();
    });

    it("should include current user's own posts in feed", async () => {
        await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token1}`)
            .send({
                title: "my own feed post",
                content: [{ type: "text", value: "hello self feed" }],
                access: { type: "free" }
            });

        const res = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${token1}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.some((post) => post.author_id)).toBe(true);
        expect(res.body.data.some((post) => post.title === "my own feed post")).toBe(true);
    });

    it("should hide content for paid followed posts before purchase", async () => {
        await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token2}`)
            .send({
                title: "locked followed post",
                description: "premium post",
                content: [{ type: "text", value: "hidden body" }],
                access: { type: "paid", price: 12 }
            });

        const res = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${token1}`);

        const paidPost = responseData(res).find((post) => post.title === "locked followed post");

        expect(res.statusCode).toBe(200);
        expect(paidPost.is_locked).toBe(true);
        expect(paidPost.content).toHaveLength(0);
    });

});
