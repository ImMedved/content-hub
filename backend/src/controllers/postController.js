/*
Post controller
*/
const postService = require("../services/postService");
const { ok, fail } = require("../utils/apiResponse");
function parseTagList(value) {
    if (Array.isArray(value)) {
        return value
            .flatMap((item) => String(item || "").split(","))
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
    }
    return String(value || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}
async function createPost(req, res) {
    try {
        const result = await postService.createPost(req.user.userId, req.body);
        ok(res, result);
    } catch (err) {
        fail(res, 400, err.message);
    }
}
async function getPost(req, res) {
    try {
        const data = await postService.getPost(req.params.id, req.user?.userId || null);
        ok(res, data);
    } catch (err) {
        fail(res, 500, err.message);
    }
}
async function listPosts(req, res) {
    try {
        const data = await postService.listPosts(
            {
                limit: req.query.limit,
                authorId: req.query.authorId,
                tag: req.query.tag,
                includeTags: parseTagList(req.query.includeTags),
                excludeTags: parseTagList(req.query.excludeTags)
            },
            req.user?.userId || null
        );
        ok(res, data);
    } catch (err) {
        fail(res, 500, err.message);
    }
}
async function listTags(req, res) {
    try {
        const data = await postService.listTags(req.query.query || "", req.query.limit);
        ok(res, data);
    } catch (err) {
        fail(res, 500, err.message);
    }
}
async function purchasePost(req, res) {
    try {
        const data = await postService.purchasePost(req.user.userId, req.params.id);
        ok(res, data);
    } catch (err) {
        fail(res, 400, err.message);
    }
}
async function getReactionUsers(req, res) {
    try {
        const data = await postService.getReactionUsers(req.params.id, req.user.userId);
        ok(res, data);
    } catch (err) {
        fail(res, 400, err.message);
    }
}
module.exports = {
    createPost,
    getPost,
    listPosts,
    listTags,
    purchasePost,
    getReactionUsers
};
