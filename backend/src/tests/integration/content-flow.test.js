/*
Integration content flow
- create post
- read post
- list posts
*/

const request = require("supertest");
const app = require("../../app");
const { apiPath, responseToken } = require("../helpers/api");

describe("Content flow", () => {
    it("should create and read post", async () => {
        await request(app).post(apiPath("/auth/register")).send({
            username: "content_user",
            email: "content_user@test.com",
            password: "123456"
        });

        const loginRes = await request(app)
            .post(apiPath("/auth/login"))
            .send({
                email: "content_user@test.com",
                password: "123456"
            });

        const token = responseToken(loginRes);

        const createRes = await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "integration post",
                description: "integration desc",
                content: [{ type: "text", value: "integration text" }],
                access: { type: "free" }
            });

        expect(createRes.statusCode).toBe(200);

        const postId = createRes.body.data.postId;

        const getRes = await request(app)
            .get(apiPath(`/posts/${postId}`));

        expect(getRes.statusCode).toBe(200);
        expect(getRes.body.data.post.title).toBe("integration post");

        const listRes = await request(app)
            .get(apiPath("/posts"));

        expect(listRes.statusCode).toBe(200);
        expect(Array.isArray(listRes.body.data)).toBe(true);
    });
});
