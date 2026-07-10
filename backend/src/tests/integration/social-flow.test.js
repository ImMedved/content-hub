const request = require("supertest");
const app = require("../../app");
const { apiPath, responseData, responseToken } = require("../helpers/api");

describe("Social flow", () => {
    it("should support follow, profile, comment, and reaction lifecycle", async () => {
        await request(app).post(apiPath("/auth/register")).send({
            username: "social_author",
            email: "social_author@test.com",
            password: "123456"
        });

        await request(app).post(apiPath("/auth/register")).send({
            username: "social_reader",
            email: "social_reader@test.com",
            password: "123456"
        });

        const authorLogin = await request(app).post(apiPath("/auth/login")).send({
            email: "social_author@test.com",
            password: "123456"
        });

        const readerLogin = await request(app).post(apiPath("/auth/login")).send({
            email: "social_reader@test.com",
            password: "123456"
        });

        const authorToken = responseToken(authorLogin);
        const readerToken = responseToken(readerLogin);

        const authorMe = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${authorToken}`);

        const authorId = responseData(authorMe).id;

        const postRes = await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${authorToken}`)
            .send({
                title: "social post",
                description: "social description",
                content: [{ type: "text", value: "social content" }],
                tags: ["social"],
                access: { type: "paid", price: 20 }
            });

        const postId = responseData(postRes).postId;

        const followRes = await request(app)
            .post(apiPath(`/follow/${authorId}`))
            .set("Authorization", `Bearer ${readerToken}`);

        expect(followRes.statusCode).toBe(200);

        const profileRes = await request(app).get(apiPath(`/users/${authorId}`));
        expect(profileRes.statusCode).toBe(200);
        expect(responseData(profileRes).username).toBe("social_author");
        expect(Array.isArray(responseData(profileRes).posts)).toBe(true);

        const followingRes = await request(app)
            .get(apiPath("/users/me/following"))
            .set("Authorization", `Bearer ${readerToken}`);

        expect(responseData(followingRes).some((user) => user.id === authorId)).toBe(true);

        const feedRes = await request(app)
            .get(apiPath("/feed"))
            .set("Authorization", `Bearer ${readerToken}`);

        expect(feedRes.statusCode).toBe(200);
        expect(responseData(feedRes).some((post) => post.id === postId)).toBe(true);
        expect(responseData(feedRes).find((post) => post.id === postId).is_locked).toBe(true);

        const purchaseRes = await request(app)
            .post(apiPath(`/posts/${postId}/purchase`))
            .set("Authorization", `Bearer ${readerToken}`);

        expect(purchaseRes.statusCode).toBe(200);

        const commentRes = await request(app)
            .post(apiPath("/comments"))
            .set("Authorization", `Bearer ${readerToken}`)
            .send({
                postId,
                content: "social comment"
            });

        expect(commentRes.statusCode).toBe(200);

        const reactionRes = await request(app)
            .post(apiPath("/reactions"))
            .set("Authorization", `Bearer ${readerToken}`)
            .send({
                postId,
                type: "like"
            });

        expect(reactionRes.statusCode).toBe(200);

        const postDetailRes = await request(app).get(apiPath(`/posts/${postId}`));
        expect(postDetailRes.statusCode).toBe(200);
        expect(responseData(postDetailRes).post.title).toBe("social post");
        expect(responseData(postDetailRes).post.author_username).toBe("social_author");
        expect(responseData(postDetailRes).tags).toContain("social");

        const commentsRes = await request(app).get(apiPath(`/comments/post/${postId}`));
        expect(commentsRes.statusCode).toBe(200);
        expect(responseData(commentsRes)).toHaveLength(1);
        expect(responseData(commentsRes)[0].author_username).toBe("social_reader");

        const reactionsRes = await request(app).get(apiPath(`/reactions/${postId}`));
        expect(reactionsRes.statusCode).toBe(200);
        expect(Number(responseData(reactionsRes)[0].count)).toBe(1);
    });
});
