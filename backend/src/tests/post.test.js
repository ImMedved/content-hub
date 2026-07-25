/*
Post tests
*/
const request = require("supertest");
const app = require("../app");
const db = require("../db/db");
const { apiPath, responseData, responseToken } = require("./helpers/api");
let token;
let postId;
beforeEach(async () => {
    await request(app).post(apiPath("/auth/register")).send({
        username: "postuser",
        email: "post@test.com",
        password: "123456"
    });
    const res = await request(app).post(apiPath("/auth/login")).send({
        email: "post@test.com",
        password: "123456"
    });
    token = responseToken(res);
    const postRes = await request(app)
        .post(apiPath("/posts"))
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "seed post",
            description: "seed desc",
            content: [
                { type: "text", value: "seed body" }
            ],
            access: { type: "free" }
        });
    postId = responseData(postRes).postId;
});
describe("Post API", () => {
    it("should create post", async () => {
        const res = await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "test post",
                description: "desc",
                content: [
                    { type: "text", value: "hello" }
                ],
                tags: ["news", "test"],
                access: { type: "free" }
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.postId).toBeDefined();
    });
    it("should list posts", async () => {
        const res = await request(app)
            .get(apiPath("/posts"));
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
    it("should return post by id", async () => {
        const res = await request(app)
            .get(apiPath(`/posts/${postId}`));
        expect(res.statusCode).toBe(200);
        expect(responseData(res).post.id).toBe(postId);
        expect(responseData(res).post.title).toBe("seed post");
        expect(responseData(res).post.author_username).toBe("postuser");
    });
    it("should filter posts by tag", async () => {
        await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "tagged post",
                description: "with tags",
                content: [{ type: "text", value: "hello tags" }],
                tags: ["music"],
                access: { type: "free" }
            });
        const res = await request(app).get(apiPath("/posts?tag=music"));
        expect(res.statusCode).toBe(200);
        expect(responseData(res)).toHaveLength(1);
        expect(responseData(res)[0].tags).toContain("music");
    });
    it("should require purchase for paid posts and unlock after purchase", async () => {
        await request(app).post(apiPath("/auth/register")).send({
            username: "buyer",
            email: "buyer@test.com",
            password: "123456"
        });
        const buyerLogin = await request(app).post(apiPath("/auth/login")).send({
            email: "buyer@test.com",
            password: "123456"
        });
        const buyerToken = responseToken(buyerLogin);
        const paidPostRes = await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "paid post",
                description: "premium",
                content: [{ type: "text", value: "secret body" }],
                tags: ["premium"],
                access: { type: "paid", price: 15 }
            });
        const paidPostId = responseData(paidPostRes).postId;
        const authorRes = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${token}`);
        const authorId = responseData(authorRes).id;
        const lockedRes = await request(app)
            .get(apiPath(`/posts/${paidPostId}`))
            .set("Authorization", `Bearer ${buyerToken}`);
        expect(lockedRes.statusCode).toBe(200);
        expect(responseData(lockedRes).post.is_locked).toBe(true);
        expect(responseData(lockedRes).content).toHaveLength(0);
        const purchaseRes = await request(app)
            .post(apiPath(`/posts/${paidPostId}/purchase`))
            .set("Authorization", `Bearer ${buyerToken}`);
        expect(purchaseRes.statusCode).toBe(200);
        expect(responseData(purchaseRes).walletBalance).toBe(85);
        expect(responseData(purchaseRes).commissionAmount).toBe(1.5);
        expect(responseData(purchaseRes).sellerIncome).toBe(13.5);
        const [sellerWalletRows] = await db.query(
            "SELECT balance FROM wallet WHERE user_id = ?",
            [authorId]
        );
        expect(Number(sellerWalletRows[0].balance)).toBe(113.5);
        const unlockedRes = await request(app)
            .get(apiPath(`/posts/${paidPostId}`))
            .set("Authorization", `Bearer ${buyerToken}`);
        expect(unlockedRes.statusCode).toBe(200);
        expect(responseData(unlockedRes).post.is_locked).toBe(false);
        expect(responseData(unlockedRes).content).toHaveLength(1);
    });
    it("should reject buying your own paid post", async () => {
        const paidPostRes = await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "self-owned paid post",
                description: "premium",
                content: [{ type: "text", value: "secret body" }],
                access: { type: "paid", price: 10 }
            });
        const paidPostId = responseData(paidPostRes).postId;
        const purchaseRes = await request(app)
            .post(apiPath(`/posts/${paidPostId}/purchase`))
            .set("Authorization", `Bearer ${token}`);
        expect(purchaseRes.statusCode).toBe(400);
        expect(purchaseRes.body.error).toMatch(/already own this post/i);
    });
    it("should reject buying a free post", async () => {
        await request(app).post(apiPath("/auth/register")).send({
            username: "free_buyer",
            email: "free_buyer@test.com",
            password: "123456"
        });
        const buyerLogin = await request(app).post(apiPath("/auth/login")).send({
            email: "free_buyer@test.com",
            password: "123456"
        });
        const buyerToken = responseToken(buyerLogin);
        const purchaseRes = await request(app)
            .post(apiPath(`/posts/${postId}/purchase`))
            .set("Authorization", `Bearer ${buyerToken}`);
        expect(purchaseRes.statusCode).toBe(400);
        expect(purchaseRes.body.error).toMatch(/does not require purchase/i);
    });
    it("should reject purchase when wallet balance is insufficient", async () => {
        await request(app).post(apiPath("/auth/register")).send({
            username: "poor_buyer",
            email: "poor_buyer@test.com",
            password: "123456"
        });
        const buyerLogin = await request(app).post(apiPath("/auth/login")).send({
            email: "poor_buyer@test.com",
            password: "123456"
        });
        const buyerToken = responseToken(buyerLogin);
        const buyerMe = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${buyerToken}`);
        await db.query("UPDATE wallet SET balance = 5 WHERE user_id = ?", [responseData(buyerMe).id]);
        const paidPostRes = await request(app)
            .post(apiPath("/posts"))
            .set("Authorization", `Bearer ${token}`)
            .send({
                title: "expensive paid post",
                description: "premium",
                content: [{ type: "text", value: "secret body" }],
                access: { type: "paid", price: 15 }
            });
        const paidPostId = responseData(paidPostRes).postId;
        const purchaseRes = await request(app)
            .post(apiPath(`/posts/${paidPostId}/purchase`))
            .set("Authorization", `Bearer ${buyerToken}`);
        expect(purchaseRes.statusCode).toBe(400);
        expect(purchaseRes.body.error).toMatch(/insufficient funds/i);
    });
});
