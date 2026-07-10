/*
Feed service
- get feed
- redis cache
*/

const feedRepo = require("../repositories/feedRepository");
const redisClient = require("../config/redis");

async function getFeed(userId) {
    const cacheKey = `feed:${userId}`; // ключ для кэша в Redis, чтобы хранить ленту пользователя по его идентификатору
    const postService = require("./postService"); // импортируем postService внутри функции, чтобы избежать циклической зависимости

    // проверяем, есть ли кэш в Redis для ленты пользователя, если есть, то возвращаем его, иначе получаем ленту из базы данных и сохраняем в кэш
    if (redisClient && redisClient.isOpen) { 
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (err) {
            console.warn("Redis feed cache read failed:", err.message);
        }
    }

    const rawPosts = await feedRepo.getFeed(userId); // получаем сырые данные ленты пользователя из базы данных, 
    // которые содержат только идентификаторы постов и их авторов, без полной информации о постах
    const data = await postService.hydratePosts(rawPosts, userId); // преобразуем сырые данные ленты в полные данные постов, 
    // включая информацию о постах, авторах, комментариях и т.д.

    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.setEx(cacheKey, 60, JSON.stringify(data));
        } catch (err) {
            console.warn("Redis feed cache write failed:", err.message);
        }
    }

    return data;
}
// инвалидируем кэш ленты пользователя в Redis, чтобы при следующем запросе ленты пользователя данные были получены из базы данных, а не из кэша
// это нужно, например, при обновлении профиля пользователя, чтобы изменения отразились в его ленте и ленте его подписчиков
async function invalidateFeed(userId) {
    const cacheKey = `feed:${userId}`;
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.del(cacheKey);
        } catch (err) {
            console.warn("Redis feed cache invalidation failed:", err.message);
        }
    }
}

module.exports = {
    getFeed,
    invalidateFeed
};
