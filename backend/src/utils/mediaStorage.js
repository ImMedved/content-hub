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

function buildUploadName(prefix, extension) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
}

function saveBuffer(buffer, prefix, extension = "bin") {
    const fileName = buildUploadName(prefix, extension);
    const filePath = path.join(uploadsDir, fileName);

    ensureUploadsDir();
    fs.writeFileSync(filePath, buffer);

    return `/uploads/${fileName}`;
}

function parseDataUrl(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
        return null;
    }

    const matches = dataUrl.match(/^data:(.+?);base64,(.+)$/);

    if (!matches) {
        throw new Error("Invalid file payload");
    }

    const [, mimeType, base64Payload] = matches;

    return {
        mimeType,
        extension: getExtensionFromMimeType(mimeType),
        buffer: Buffer.from(base64Payload, "base64")
    };
}

function saveDataUrl(dataUrl, prefix) {
    const parsed = parseDataUrl(dataUrl);

    if (!parsed) {
        return dataUrl;
    }

    return saveBuffer(parsed.buffer, prefix, parsed.extension);
}

module.exports = {
    ensureUploadsDir,
    parseDataUrl,
    saveBuffer,
    saveDataUrl
};
