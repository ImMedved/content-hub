/*
Reaction service
*/

const reactionRepo = require("../repositories/reactionRepository");

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
}

async function removeReaction(userId, postId) {
    await reactionRepo.removeReaction(userId, postId);
}

async function getReactions(postId) {
    return await reactionRepo.getReactions(postId);
}

module.exports = {
    addReaction,
    removeReaction,
    getReactions
};
