/*
Comment service
*/
const commentRepo = require("../repositories/commentRepository");

const COMMENT_LENGTH_LIMIT = 500;

async function createComment(userId, data) {
    const { postId, content } = data;
    const trimmedContent = String(content || "").trim();

    if (!trimmedContent) {
        throw new Error("Comment content is required");
    }

    if (trimmedContent.length > COMMENT_LENGTH_LIMIT) {
        throw new Error("Comment is too long");
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

async function updateComment(userId, commentId, content) {
    const trimmedContent = String(content || "").trim();

    if (!trimmedContent) {
        throw new Error("Comment content is required");
    }

    if (trimmedContent.length > COMMENT_LENGTH_LIMIT) {
        throw new Error("Comment is too long");
    }

    const updatedRows = await commentRepo.updateComment(commentId, userId, trimmedContent);

    if (!updatedRows) {
        throw new Error("Comment not found or you cannot edit it");
    }

    return true;
}

module.exports = {
    createComment,
    getComments,
    deleteComment,
    updateComment
};
