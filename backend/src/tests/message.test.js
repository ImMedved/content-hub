const request = require("supertest");

const app = require("../app");
const { apiPath, responseData, responseToken } = require("./helpers/api");

async function registerAndLogin(username, email) {
    await request(app)
        .post(apiPath("/auth/register"))
        .send({
            username,
            email,
            password: "123456"
        });

    const loginRes = await request(app)
        .post(apiPath("/auth/login"))
        .send({
            email,
            password: "123456"
        });

    const token = responseToken(loginRes);
    const meRes = await request(app)
        .get(apiPath("/users/me"))
        .set("Authorization", `Bearer ${token}`);

    return {
        token,
        user: responseData(meRes)
    };
}

describe("Message API", () => {
    it("should send messages, list chats, and load a conversation", async () => {
        const author = await registerAndLogin("message_author", "message_author@test.com");
        const reader = await registerAndLogin("message_reader", "message_reader@test.com");

        await request(app)
            .post(apiPath(`/follow/${reader.user.id}`))
            .set("Authorization", `Bearer ${author.token}`);

        const sendRes = await request(app)
            .post(apiPath(`/messages/${reader.user.id}`))
            .set("Authorization", `Bearer ${author.token}`)
            .send({ body: "Hello there" });

        expect(sendRes.statusCode).toBe(200);
        expect(responseData(sendRes).body).toBe("Hello there");

        const chatsRes = await request(app)
            .get(apiPath("/messages/chats"))
            .set("Authorization", `Bearer ${reader.token}`);

        expect(chatsRes.statusCode).toBe(200);
        expect(responseData(chatsRes)[0].peer.id).toBe(author.user.id);
        expect(responseData(chatsRes)[0].unread_count).toBe(1);

        const conversationRes = await request(app)
            .get(apiPath(`/messages/${author.user.id}`))
            .set("Authorization", `Bearer ${reader.token}`);

        expect(conversationRes.statusCode).toBe(200);
        expect(responseData(conversationRes)).toHaveLength(1);
        expect(responseData(conversationRes)[0].sender.id).toBe(author.user.id);

        const refreshedChatsRes = await request(app)
            .get(apiPath("/messages/chats"))
            .set("Authorization", `Bearer ${reader.token}`);

        expect(responseData(refreshedChatsRes)[0].unread_count).toBe(0);
    });

    it("should block starting a new chat with a user that is not followed", async () => {
        const author = await registerAndLogin("message_block_author", "message_block_author@test.com");
        const reader = await registerAndLogin("message_block_reader", "message_block_reader@test.com");

        const sendRes = await request(app)
            .post(apiPath(`/messages/${reader.user.id}`))
            .set("Authorization", `Bearer ${author.token}`)
            .send({ body: "This should fail" });

        expect(sendRes.statusCode).toBe(400);
        expect(sendRes.body.error).toMatch(/follow/i);
    });

    it("should reject empty message body", async () => {
        const author = await registerAndLogin("message_empty_author", "message_empty_author@test.com");
        const reader = await registerAndLogin("message_empty_reader", "message_empty_reader@test.com");

        await request(app)
            .post(apiPath(`/follow/${reader.user.id}`))
            .set("Authorization", `Bearer ${author.token}`);

        const sendRes = await request(app)
            .post(apiPath(`/messages/${reader.user.id}`))
            .set("Authorization", `Bearer ${author.token}`)
            .send({ body: "   " });

        expect(sendRes.statusCode).toBe(400);
        expect(sendRes.body.error).toMatch(/message body is required/i);
    });

    it("should reject messaging yourself", async () => {
        const author = await registerAndLogin("message_self_author", "message_self_author@test.com");

        const sendRes = await request(app)
            .post(apiPath(`/messages/${author.user.id}`))
            .set("Authorization", `Bearer ${author.token}`)
            .send({ body: "self talk" });

        expect(sendRes.statusCode).toBe(400);
        expect(sendRes.body.error).toMatch(/cannot message yourself/i);
    });

    it("should reject invalid conversation peer id", async () => {
        const author = await registerAndLogin("message_invalid_author", "message_invalid_author@test.com");

        const conversationRes = await request(app)
            .get(apiPath("/messages/not-a-user"))
            .set("Authorization", `Bearer ${author.token}`);

        expect(conversationRes.statusCode).toBe(400);
        expect(conversationRes.body.error).toMatch(/invalid user id/i);
    });
});
