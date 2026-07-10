const crypto = require("crypto");

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getEmailHash(email) {
    const normalized = normalizeEmail(email);

    if (!normalized) {
        return "";
    }

    return crypto
        .createHmac("sha256", process.env.EMAIL_HASH_SECRET || process.env.JWT_SECRET || "content-platform-email")
        .update(normalized)
        .digest("hex");
}

module.exports = {
    normalizeEmail,
    getEmailHash
};
