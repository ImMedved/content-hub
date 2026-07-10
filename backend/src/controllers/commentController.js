/*
Comment controller
*/
const commentService = require("../services/commentService");
const { ok, fail } = require("../utils/apiResponse");
async function createComment(req, res) {
    try {
        const result = await commentService.createComment(
            req.user.userId,
            req.body
        );
        ok(res, result);
    } catch (err) {
        fail(res, 400, err.message);
    }
}
async function getComments(req, res) {
    try {
        const data = await commentService.getComments(req.params.postId);
        ok(res, data);
    } catch (err) {
        fail(res, 500, err.message);
    }
}
async function deleteComment(req, res) {
    try {
        const result = await commentService.deleteComment(
            req.user.userId,
            req.params.id
        );
        ok(res, result);
    } catch (err) {
        fail(res, 400, err.message);
    }
}
module.exports = {
    createComment,
    getComments,
    deleteComment
};
