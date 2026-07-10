/*
Integration feed flow
- follow
- create post
- read feed
*/

const request = require("supertest");
const app = require("../../app");
const { apiPath, responseToken } = require("../helpers/api");

describe("Feed flow", () => {
    it("should show followed author posts in feed", async () => {
        await request(app).post(apiPath("/auth/register")).send({
            username: "follower_user",
            email: "follower_user@test.com",
            password: "123456"
        });

        await request(app).post(apiPath("/auth/register")).send({
            username: "author_user",
            email: "author_user@test.com",
            password: "123456"
        });

        const followerLogin = await request(app)
            .post(apiPath("/auth/login"))
            .send({
                email: "follower_user@test.com",
                password: "123456"
            });

        const authorLogin = await request(app)
            .post(apiPath("/auth/login"))
            .send({
                email: "author_user@test.com",
                password: "123456"
            });

        const followerToken = responseToken(followerLogin);
        const authorToken = responseToken(authorLogin);

        const meAuthor = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${authorToken}`);

        const authorId = meAuthor.body.data.id;

        await request(app)
            .post(apiPath(`/follow/${authorId}`))
            .set("Authorization", `Bearer ${followerToken}`);

        await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${authorToken}`)
            .send({
                title: "author post",
                content: [{ type: "text", value: "post for feed" }],
                access: { type: "free" }
            });

        const feedRes = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${followerToken}`);

        expect(feedRes.statusCode).toBe(200);
        expect(feedRes.body.data.length).toBeGreaterThan(0);
    });
});
