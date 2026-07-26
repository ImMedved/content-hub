/*
Reaction controller
*/

const reactionService = require("../services/reactionService");
const { ok, fail } = require("../utils/apiResponse");

async function addReaction(req, res) {
    try {
        await reactionService.addReaction(req.user.userId, req.body);
        ok(res, true);
    } catch (err) {
        fail(res, 400, err.message);
    }
}

async function removeReaction(req, res) {
    try {
        await reactionService.removeReaction(
            req.user.userId,
            req.params.postId
        );

        ok(res, true);
    } catch (err) {
        fail(res, 400, err.message);
    }
}

async function getReactions(req, res) {
    try {
        const includeViewer = String(req.query.includeViewer || "").toLowerCase() === "true";
        const data = await reactionService.getReactions(
            req.params.postId,
            includeViewer ? req.user?.userId || null : null,
            includeViewer
        );
        ok(res, data);
    } catch (err) {
        fail(res, 500, err.message);
    }
}

module.exports = {
    addReaction,
    removeReaction,
    getReactions
};
