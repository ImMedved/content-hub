/*
Integration auth flow
- register
- login
- get me
*/

const request = require("supertest");
const app = require("../../app");
const { apiPath, responseToken } = require("../helpers/api");

describe("Auth flow", () => {
    it("should complete full auth flow", async () => {
        const registerRes = await request(app)
            .post(apiPath("/auth/register"))
            .send({
                username: "flow_user",
                email: "flow_user@test.com",
                password: "123456"
            });

        expect(registerRes.statusCode).toBe(200);

        const loginRes = await request(app)
            .post(apiPath("/auth/login"))
            .send({
                email: "flow_user@test.com",
                password: "123456"
            });

        expect(loginRes.statusCode).toBe(200);

        const token = responseToken(loginRes);

        const meRes = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${token}`);

        expect(meRes.statusCode).toBe(200);
        expect(meRes.body.data.username).toBe("flow_user");
        expect(meRes.body.data.email).toBeUndefined();
    });
});
