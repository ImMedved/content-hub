const API_PREFIX = "/api/v1";

function apiPath(path) {
    return `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

function responseData(res) {
    return res.body.data;
}

function responseToken(res) {
    const token = responseData(res)?.token;

    if (!token) {
        throw new Error("Expected auth response to include data.token");
    }

    return token;
}

module.exports = {
    apiPath,
    responseData,
    responseToken
};
