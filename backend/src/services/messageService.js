const followRepo = require("../repositories/followRepository");
const messageRepo = require("../repositories/messageRepository");
const userRepo = require("../repositories/userRepository");
const realtimeService = require("./messageRealtimeService");

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
    waitForUpdates
};
