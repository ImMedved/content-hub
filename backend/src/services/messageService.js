const followRepo = require("../repositories/followRepository");
const messageRepo = require("../repositories/messageRepository");
const userRepo = require("../repositories/userRepository");
const audioProcessingService = require("./audioProcessingService");
const minioStorageService = require("./minioStorageService");
const realtimeService = require("./messageRealtimeService");
const videoProcessingService = require("./videoProcessingService");
const { parseDataUrl } = require("../utils/mediaStorage");

function normalizePeerId(peerId) {
    const parsed = Number(peerId);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid user id");
    }

    return parsed;
}

async function assertPeerExists(peerId) {
    const peer = await userRepo.findById(peerId);

    if (!peer) {
        throw new Error("User not found");
    }
}

async function assertCanMessage(userId, peerId) {
    if (userId === peerId) {
        throw new Error("You cannot message yourself");
    }

    await assertPeerExists(peerId);

    const [isFollowing, hasConversation] = await Promise.all([
        followRepo.isFollowing(userId, peerId),
        messageRepo.hasConversation(userId, peerId)
    ]);

    if (!isFollowing && !hasConversation) {
        throw new Error("You can only start chats with users you follow");
    }
}

async function listChats(userId) {
    return messageRepo.getChats(userId);
}

async function getConversation(userId, peerIdInput) {
    const peerId = normalizePeerId(peerIdInput);
    await assertPeerExists(peerId);
    await messageRepo.markConversationRead(userId, peerId);
    return messageRepo.getConversationMessages(userId, peerId);
}

async function sendMessage(userId, peerIdInput, body) {
    const peerId = normalizePeerId(peerIdInput);
    const trimmedBody = String(body || "").trim();

    if (!trimmedBody) {
        throw new Error("Message body is required");
    }

    await assertCanMessage(userId, peerId);

    const message = await messageRepo.createMessage(userId, peerId, trimmedBody);
    await realtimeService.notifyUsers([userId, peerId]);

    return message;
}

function normalizeMediaType(value) {
    const mediaType = String(value || "").trim().toLowerCase();

    if (mediaType !== "audio" && mediaType !== "video") {
        throw new Error("Message media type must be audio or video");
    }

    return mediaType;
}

function normalizeMediaPayload(data, mediaType) {
    const parsed = parseDataUrl(data?.file || data?.dataUrl || data?.value);

    if (!parsed) {
        throw new Error("Media file payload is required");
    }

    if (!String(parsed.mimeType || "").startsWith(`${mediaType}/`)) {
        throw new Error(`Only ${mediaType} files can be sent here`);
    }

    return {
        parsed,
        body: String(data?.body || "").trim(),
        filename: String(data?.filename || `${mediaType}.${parsed.extension}`)
    };
}

async function sendMediaMessage(userId, peerIdInput, data) {
    const peerId = normalizePeerId(peerIdInput);
    const mediaType = normalizeMediaType(data?.mediaType || data?.type);
    const item = normalizeMediaPayload(data || {}, mediaType);

    await assertCanMessage(userId, peerId);

    console.log(`[message-media] received senderId=${userId} recipientId=${peerId} type=${mediaType} filename=${item.filename} bytes=${item.parsed.buffer.length} mime=${item.parsed.mimeType}`);
    const originalKey = minioStorageService.buildObjectKey(`${mediaType}s/messages`, item.filename, item.parsed.extension);
    const originalObject = await minioStorageService.putObject({
        key: originalKey,
        buffer: item.parsed.buffer,
        contentType: item.parsed.mimeType
    });
    const hlsStoragePrefix = `messages/${mediaType}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const { messageId, mediaId } = await messageRepo.createMediaMessage(userId, peerId, {
        mediaType,
        body: item.body,
        originalUrl: originalObject.url,
        originalStorageKey: originalObject.key,
        hlsStoragePrefix
    });
    const message = await messageRepo.findById(messageId);
    console.log(`[message-media] created message/media messageId=${messageId} mediaId=${mediaId} type=${mediaType} hlsPrefix=${hlsStoragePrefix}`);

    const payload = {
        mediaId,
        sourceKey: originalObject.key,
        hlsStoragePrefix
    };

    if (mediaType === "audio") {
        audioProcessingService.processAudioInBackground(payload);
    } else {
        videoProcessingService.processVideoInBackground(payload);
    }

    await realtimeService.notifyUsers([userId, peerId]);
    return message;
}

async function getMessagesSince(userId, afterIdInput) {
    const afterId = Number(afterIdInput) || 0;
    return messageRepo.getMessagesSince(userId, afterId);
}

async function waitForUpdates(userId, afterIdInput) {
    const version = await realtimeService.getUserVersion(userId);
    let messages = await getMessagesSince(userId, afterIdInput);

    if (messages.length > 0) {
        return messages;
    }

    await realtimeService.waitForUserUpdate(userId, version);
    messages = await getMessagesSince(userId, afterIdInput);
    return messages;
}

module.exports = {
    listChats,
    getConversation,
    sendMessage,
    sendMediaMessage,
    waitForUpdates
};
