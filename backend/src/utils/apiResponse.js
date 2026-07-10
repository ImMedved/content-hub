function ok(res, data) {
    return res.json({ data, error: null });
}

function fail(res, status, message) {
    const normalizedMessage =
        typeof message === "string" && message.trim()
            ? message
            : "Request failed";

    return res.status(status).json({ data: null, error: normalizedMessage });
}

module.exports = {
    ok,
    fail
};
