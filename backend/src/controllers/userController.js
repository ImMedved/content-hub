/*
User controller
- get current user
- update current user
*/

const userRepo = require("../repositories/userRepository");
const followService = require("../services/followService");
const postService = require("../services/postService");
const userService = require("../services/userService");
const { ok, fail } = require("../utils/apiResponse");

async function getMe(req, res) {
    try {
        const user = await userService.getMyProfile(req.user.userId);
        const posts = await postService.listPosts(
            { authorId: req.user.userId },
            req.user.userId
        );
        ok(res, { ...user, posts });
    } catch (err) {
        fail(res, 500, err.message);
    }
}

async function updateMe(req, res) {
    try {
        const user = await userService.updateMyProfile(req.user.userId, req.body);
        ok(res, user);
    } catch (err) {
        fail(res, 400, err.message);
    }
}

async function getUser(req, res) {
    try {
        const user = await userRepo.findById(req.params.id);

        if (!user) {
            ok(res, null);
            return;
        }

        const posts = await postService.listPosts(
            { authorId: req.params.id },
            req.user?.userId || null
        );
        ok(res, { ...user, posts });
    } catch (err) {
        fail(res, 500, err.message);
    }
}

async function getMyFollowing(req, res) {
    try {
        const users = await followService.getFollowingUsers(req.user.userId);
        ok(res, users);
    } catch (err) {
        fail(res, 500, err.message);
    }
}

async function getMyFollowers(req, res) {
    try {
        const users = await followService.getFollowerUsers(req.user.userId);
        ok(res, users);
    } catch (err) {
        fail(res, 500, err.message);
    }
}

async function getFollowing(req, res) {
    try {
        const users = await followService.getFollowingUsers(req.params.id);
        ok(res, users);
    } catch (err) {
        fail(res, 500, err.message);
    }
}

async function getFollowers(req, res) {
    try {
        const users = await followService.getFollowerUsers(req.params.id);
        ok(res, users);
    } catch (err) {
        fail(res, 500, err.message);
    }
}

async function getUserStatus(req, res) {
    try {
        const user = await userRepo.findById(req.params.id);

        if (!user) {
            ok(res, { online: false });
            return;
        }

        const lastLoginAt = user.last_login_at ? new Date(user.last_login_at).getTime() : 0;
        ok(res, {
            online: Boolean(lastLoginAt && Date.now() - lastLoginAt < 5 * 60 * 1000)
        });
    } catch (err) {
        fail(res, 500, err.message);
    }
}

module.exports = {
    getMe,
    updateMe,
    getUser,
    getMyFollowing,
    getMyFollowers,
    getFollowing,
    getFollowers,
    getUserStatus
};
