const fs = require("fs");
const path = require("path");

const uploadsDir = path.join(__dirname, "../../uploads");

function ensureUploadsDir() {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function getExtensionFromMimeType(mimeType) {
    const parts = String(mimeType || "").split("/");
    return parts[1] || "bin";
}

function saveDataUrl(dataUrl, prefix) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
        return dataUrl;
    }

    const matches = dataUrl.match(/^data:(.+?);base64,(.+)$/);

    if (!matches) {
        throw new Error("Invalid file payload");
    }

    const [, mimeType, base64Payload] = matches;
    const extension = getExtensionFromMimeType(mimeType);
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);

    ensureUploadsDir();
    fs.writeFileSync(filePath, Buffer.from(base64Payload, "base64"));

    return `/uploads/${fileName}`;
}

module.exports = {
    ensureUploadsDir,
    saveDataUrl
};
