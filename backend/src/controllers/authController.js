const authService = require("../services/authService");
const { ok, fail } = require("../utils/apiResponse");

// register endpoint
async function register(req, res) {
    try {
        const result = await authService.register(req.body);
        ok(res, result);
    } catch (err) {
        fail(res, 400, err.message);
    }
}

// login endpoint
async function login(req, res) {
    try {
        const result = await authService.login(req.body); // Call the login function from authService with the request body
        ok(res, result); // Send a successful response with the result to the client
    } catch (err) {
        fail(res, 400, err.message);
    }
}

module.exports = {
    register,
    login
};
