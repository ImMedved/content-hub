/*
Comment service
*/
const commentRepo = require("../repositories/commentRepository");

async function createComment(userId, data) {
    const { postId, content } = data;
    const trimmedContent = String(content || "").trim();

    if (!trimmedContent) {
        throw new Error("Comment content is required");
    }

    const postService = require("./postService");
    const details = await postService.getPost(postId, userId);

    if (!details.post) {
        throw new Error("Post not found");
    }

    if (details.post.is_locked) {
        throw new Error("Purchase this post before leaving comments");
    }

    const commentId = await commentRepo.createComment(postId, userId, trimmedContent);
    return { commentId };
}

async function getComments(postId) {
    return commentRepo.getComments(postId);
}

async function deleteComment(userId, commentId) {
    const deletedRows = await commentRepo.deleteComment(commentId, userId);
    if (!deletedRows) {
        throw new Error("Comment not found or you cannot delete it");
    }
    
    return true;
}

module.exports = {
    createComment,
    getComments,
    deleteComment
};
