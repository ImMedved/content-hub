/*
Feed controller
*/

const feedService = require("../services/feedService");
const { ok, fail } = require("../utils/apiResponse");

async function getFeed(req, res) {
    try {
        const data = await feedService.getFeed(req.user.userId);
        ok(res, data);
    } catch (err) {
        fail(res, 500, err.message);
    }
}

module.exports = {
    getFeed
};
