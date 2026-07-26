const messageService = require("../services/messageService");
const { ok, fail } = require("../utils/apiResponse");

async function getChats(req, res) {
    try {
        const chats = await messageService.listChats(req.user.userId);
        ok(res, chats);
    } catch (err) {
        fail(res, 500, err.message);
    }
}

async function getConversation(req, res) {
    try {
        const messages = await messageService.getConversation(req.user.userId, req.params.userId);
        ok(res, messages);
    } catch (err) {
        fail(res, 400, err.message);
    }
}

async function sendMessage(req, res) {
    try {
        const message = await messageService.sendMessage(
            req.user.userId,
            req.params.userId,
            req.body?.body
        );
        ok(res, message);
    } catch (err) {
        fail(res, 400, err.message);
    }
}

async function sendMediaMessage(req, res) {
    try {
        const message = await messageService.sendMediaMessage(
            req.user.userId,
            req.params.userId,
            req.body || {}
        );
        ok(res, message);
    } catch (err) {
        fail(res, 400, err.message);
    }
}

async function streamMessages(req, res) {
    try {
        const messages = await messageService.waitForUpdates(req.user.userId, req.query.after);
        ok(res, { messages });
    } catch (err) {
        fail(res, 500, err.message);
    }
}

module.exports = {
    getChats,
    getConversation,
    sendMessage,
    sendMediaMessage,
    streamMessages
};
