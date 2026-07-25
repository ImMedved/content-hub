/*
Follow service
- follow actions
- feed cache reset
*/

const followRepo = require("../repositories/followRepository");
const userRepo = require("../repositories/userRepository");
const feedService = require("./feedService");
const cache = require("./redisCacheService");

async function follow(userId, targetId) {
    const normalizedTargetId = Number(targetId);
    // Проверяем, что targetId является положительным целым числом
    if (!Number.isInteger(normalizedTargetId) || normalizedTargetId <= 0) {
        throw new Error("Invalid user id");
    }
    // Проверяем, что пользователь не пытается подписаться на самого себя
    if (Number(userId) === normalizedTargetId) {
        throw new Error("You cannot follow yourself");
    }
    // Проверяем, существует ли пользователь с targetId
    const targetUser = await userRepo.findById(normalizedTargetId);
    // Проверяем, что пользователь не подписан на самого себя
    // вторая проверка на самом деле не нужна, так как мы уже проверили это выше, но оставим для безопасности
    // Number это функция, которая преобразует строку в число, если это возможно, иначе возвращает NaN.
    if (!targetUser) {
        throw new Error("User not found");
    }

    const alreadyFollowing = await followRepo.isFollowing(userId, normalizedTargetId);// Проверяем, подписан ли пользователь уже на targetId

    if (alreadyFollowing) {
        throw new Error("You are already following this user");
    }

    await followRepo.follow(userId, normalizedTargetId); // Добавляем запись в таблицу подписок, что пользователь подписан на targetId
    await cache.deleteKeys([cache.followingKey(userId), cache.followersKey(normalizedTargetId)]);
    await feedService.invalidateFeed(userId);
}

async function unfollow(userId, targetId) {
    const normalizedTargetId = Number(targetId);

    if (!Number.isInteger(normalizedTargetId) || normalizedTargetId <= 0) {
        throw new Error("Invalid user id");
    }

    if (Number(userId) === normalizedTargetId) {
        throw new Error("You cannot unfollow yourself");
    }

    const isFollowing = await followRepo.isFollowing(userId, normalizedTargetId);

    if (!isFollowing) {
        throw new Error("You are not following this user");
    }

    await followRepo.unfollow(userId, normalizedTargetId);
    await cache.deleteKeys([cache.followingKey(userId), cache.followersKey(normalizedTargetId)]);
    await feedService.invalidateFeed(userId);
}
// Получение списка идентификаторов пользователей, на которых подписан пользователь
async function getFollowing(userId) {
    return cache.getSet(cache.followingKey(userId), () => followRepo.getFollowing(userId), 300);
}
// Получение списка пользователей, на которых подписан пользователь
// От getFollowing отличается тем, что возвращает не только идентификаторы, но и полные данные пользователей
// Используется в профиле пользователя, чтобы показать список подписок
async function getFollowingUsers(userId) {
    const ids = await getFollowing(userId);
    return await userRepo.findManyByIds(ids);
}
// Получение списка пользователей, которые подписаны на пользователя
async function getFollowerUsers(userId) {
    const ids = await cache.getSet(cache.followersKey(userId), () => followRepo.getFollowers(userId), 300);
    return await userRepo.findManyByIds(ids);
}

module.exports = {
    follow,
    unfollow,
    getFollowing,
    getFollowingUsers,
    getFollowerUsers
};
