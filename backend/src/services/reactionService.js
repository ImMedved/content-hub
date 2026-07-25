/*
Reaction service
*/

const reactionRepo = require("../repositories/reactionRepository");
const cache = require("./redisCacheService");

async function addReaction(userId, data) {
    const { postId, type } = data;
    const postService = require("./postService");
    const details = await postService.getPost(postId, userId);

    if (!details.post) {
        throw new Error("Post not found");
    }

    if (details.post.is_locked) {
        throw new Error("Purchase this post before leaving reactions");
    }

    await reactionRepo.addReaction(userId, postId, type || "like");
    await cache.deleteKeys([cache.reactionCountKey(postId)]);
}

async function removeReaction(userId, postId) {
    await reactionRepo.removeReaction(userId, postId);
    await cache.deleteKeys([cache.reactionCountKey(postId)]);
}

async function getReactions(postId) {
    return await reactionRepo.getReactions(postId);
}

async function getReactionCount(postId) {
    const cached = await cache.readJson(cache.reactionCountKey(postId));
    if (typeof cached === "number") {
        return cached;
    }

    const reactions = await reactionRepo.getReactions(postId);
    const count = reactions.reduce((sum, row) => sum + Number(row.count || 0), 0);
    await cache.writeJson(cache.reactionCountKey(postId), count, 300);
    return count;
}

module.exports = {
    addReaction,
    removeReaction,
    getReactions,
    getReactionCount
};
