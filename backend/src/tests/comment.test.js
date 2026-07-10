/*
Comment tests
*/

const request = require("supertest");
const app = require("../app");
const { apiPath, responseData, responseToken } = require("./helpers/api");

let token;
let postId;
let paidPostId;
let outsiderToken;

beforeEach(async () => {
    await request(app).post(apiPath("/auth/register")).send({
        username: "comment_user",
        email: "comment@test.com",
        password: "123456"
    });

    const login = await request(app).post(apiPath("/auth/login")).send({
        email: "comment@test.com",
        password: "123456"
    });

    token = responseToken(login);

    const post = await request(app)
        .post(apiPath("/posts"))
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "post",
            content: [{ type: "text", value: "test" }]
        });

    postId = post.body.data.postId;

    const paidPost = await request(app)
        .post(apiPath("/posts"))
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "paid post",
            content: [{ type: "text", value: "premium body" }],
            access: { type: "paid", price: 15 }
        });

    paidPostId = responseData(paidPost).postId;

    await request(app).post(apiPath("/auth/register")).send({
        username: "comment_outsider",
        email: "comment_outsider@test.com",
        password: "123456"
    });

    const outsiderLogin = await request(app).post(apiPath("/auth/login")).send({
        email: "comment_outsider@test.com",
        password: "123456"
    });

    outsiderToken = responseToken(outsiderLogin);
});

describe("Comment API", () => {
    it("should create comment", async () => {
        const res = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                postId,
                content: "hello"
            });

        expect(res.statusCode).toBe(200);
    });

    it("should get comments", async () => {
        await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                postId,
                content: "hello"
            });

        const res = await request(app)
            .get(apiPath(`/comments/post/${postId}`));

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data[0].author_username).toBe("comment_user");
    });

    it("should delete own comment", async () => {
        const createRes = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                postId,
                content: "delete me"
            });

        const commentId = createRes.body.data.commentId;

        const deleteRes = await request(app)
            .delete(apiPath(`/comments/${commentId}`))
            .set("Authorization", `Bearer ${token}`);

        expect(deleteRes.statusCode).toBe(200);
        expect(deleteRes.body.data).toBe(true);
    });

    it("should reject empty comments", async () => {
        const res = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                postId,
                content: "   "
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/comment content is required/i);
    });

    it("should reject comments on locked paid posts", async () => {
        const res = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${outsiderToken}`)
            .send({
                postId: paidPostId,
                content: "let me in"
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/purchase this post/i);
    });

    it("should reject deleting another user's comment", async () => {
        const createRes = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                postId,
                content: "author comment"
            });

        const commentId = responseData(createRes).commentId;

        const deleteRes = await request(app)
            .delete(apiPath(`/comments/${commentId}`))
            .set("Authorization", `Bearer ${outsiderToken}`);

        expect(deleteRes.statusCode).toBe(400);
        expect(deleteRes.body.error).toMatch(/cannot delete/i);
    });

    it("should update own comment", async () => {
        const createRes = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                postId,
                content: "draft comment"
            });

        const commentId = responseData(createRes).commentId;

        const updateRes = await request(app)
            .put(apiPath(`/comments/${commentId}`))
            .set("Authorization", `Bearer ${token}`)
            .send({
                content: "updated comment"
            });

        expect(updateRes.statusCode).toBe(200);

        const commentsRes = await request(app).get(apiPath(`/comments/post/${postId}`));
        expect(responseData(commentsRes)[0].content).toBe("updated comment");
    });

    it("should allow the post author to delete another user's comment", async () => {
        const createRes = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${outsiderToken}`)
            .send({
                postId,
                content: "reader comment"
            });

        const commentId = responseData(createRes).commentId;

        const deleteRes = await request(app)
            .delete(apiPath(`/comments/${commentId}`))
            .set("Authorization", `Bearer ${token}`);

        expect(deleteRes.statusCode).toBe(200);
        expect(responseData(deleteRes)).toBe(true);
    });
});
