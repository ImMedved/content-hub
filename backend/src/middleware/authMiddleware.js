/*
Auth middleware
- verify jwt
- attach user to request
*/

const jwt = require("jsonwebtoken");
const { fail } = require("../utils/apiResponse");

function authMiddleware(req, res, next) {
    const header = req.headers["authorization"];

    if (!header) {
        return fail(res, 401, "No token");
    }

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return fail(res, 401, "Invalid token");
    }
}

module.exports = authMiddleware;
