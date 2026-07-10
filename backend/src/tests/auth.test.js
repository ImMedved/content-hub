/*
Auth tests
- register endpoint
- login endpoint
*/

const request = require("supertest");
const app = require("../app");
const db = require("../db/db");
const { apiPath, responseData } = require("./helpers/api");

describe("Auth API", () => {

    const email = `test_${Date.now()}@test.com`;

    it("should register user", async () => {
        const res = await request(app)
            .post(apiPath("/auth/register"))
            .send({
                username: "test",
                email,
                password: "123456"
            });

        expect(res.statusCode).toBe(200);
        expect(responseData(res).userId).toBeDefined();

        const [rows] = await db.query(
            "SELECT email_hash FROM users WHERE id = ?",
            [responseData(res).userId]
        );

        expect(rows[0].email_hash).toBeDefined();
        expect(rows[0].email_hash).not.toBe(email);
    });

    it("should login user", async () => {
        const loginEmail = `login_${Date.now()}@test.com`;

        await request(app)
            .post(apiPath("/auth/register"))
            .send({
                username: "login_test",
                email: loginEmail,
                password: "123456"
            });

        const res = await request(app)
            .post(apiPath("/auth/login"))
            .send({
                email: loginEmail,
                password: "123456"
            });

        expect(res.statusCode).toBe(200);
        expect(responseData(res).token).toBeDefined();
    });

    it("should reject duplicate registration", async () => {
        const duplicateEmail = `duplicate_${Date.now()}@test.com`;

        await request(app)
            .post(apiPath("/auth/register"))
            .send({
                username: "dup_user_a",
                email: duplicateEmail,
                password: "123456"
            });

        const res = await request(app)
            .post(apiPath("/auth/register"))
            .send({
                username: "dup_user_b",
                email: duplicateEmail,
                password: "123456"
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBeTruthy();
    });

    it("should reject login with wrong password", async () => {
        const loginEmail = `wrong_password_${Date.now()}@test.com`;

        await request(app)
            .post(apiPath("/auth/register"))
            .send({
                username: "wrong_password_user",
                email: loginEmail,
                password: "123456"
            });

        const res = await request(app)
            .post(apiPath("/auth/login"))
            .send({
                email: loginEmail,
                password: "bad-password"
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/invalid password/i);
    });

    it("should create starter wallet on registration", async () => {
        const walletEmail = `wallet_${Date.now()}@test.com`;

        await request(app)
            .post(apiPath("/auth/register"))
            .send({
                username: "wallet_test",
                email: walletEmail,
                password: "123456"
            });

        const loginRes = await request(app)
            .post(apiPath("/auth/login"))
            .send({
                email: walletEmail,
                password: "123456"
            });

        const meRes = await request(app)
            .get(apiPath("/users/me"))
            .set("Authorization", `Bearer ${responseData(loginRes).token}`);

        expect(meRes.statusCode).toBe(200);
        expect(responseData(meRes).wallet_balance).toBe(100);
    });

});
