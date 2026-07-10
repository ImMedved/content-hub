const request = require("supertest");

const app = require("../../app");
const { apiPath, responseData, responseToken } = require("../helpers/api");

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

describe("Message flow", () => {
    it("should deliver new messages through the realtime stream", async () => {
        const author = await registerAndLogin("stream_author", "stream_author@test.com");
        const reader = await registerAndLogin("stream_reader", "stream_reader@test.com");

        await request(app)
            .post(apiPath(`/follow/${reader.user.id}`))
            .set("Authorization", `Bearer ${author.token}`);

        const streamPromise = request(app)
            .get(apiPath("/messages/stream?after=0"))
            .set("Authorization", `Bearer ${reader.token}`);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const sendRes = await request(app)
            .post(apiPath(`/messages/${reader.user.id}`))
            .set("Authorization", `Bearer ${author.token}`)
            .send({ body: "Realtime hello" });

        expect(sendRes.statusCode).toBe(200);

        const streamRes = await streamPromise;

        expect(streamRes.statusCode).toBe(200);
        expect(responseData(streamRes).messages).toHaveLength(1);
        expect(responseData(streamRes).messages[0].body).toBe("Realtime hello");
        expect(responseData(streamRes).messages[0].sender.id).toBe(author.user.id);
    });
});
