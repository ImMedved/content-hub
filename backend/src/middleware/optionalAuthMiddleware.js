const jwt = require("jsonwebtoken");

function optionalAuthMiddleware(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        next();
        return;
    }

    const token = header.split(" ")[1];

    if (!token) {
        next();
        return;
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        req.user = null;
    }

    next();
}

module.exports = optionalAuthMiddleware;
