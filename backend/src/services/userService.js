const userRepo = require("../repositories/userRepository");
const walletRepo = require("../repositories/walletRepository");
const followRepo = require("../repositories/followRepository");
const feedService = require("./feedService");
const { saveDataUrl } = require("../utils/mediaStorage");

// Получение профиля текущего пользователя
async function getMyProfile(userId) {
    const [user, wallet] = await Promise.all([
        userRepo.findById(userId),
        walletRepo.getWallet(userId)
    ]);

    if (!user) {
        return null;
    }
    // Возвращаем объект пользователя с балансом кошелька, если он существует, иначе 0
    return {
        ...user,
        wallet_balance: Number(wallet?.balance || 0)
    };
}
// Обновление профиля текущего пользователя
// Текущий пользователь определяется по userId, который получается из JWT токена, переданного в заголовке Authorization
async function updateMyProfile(userId, data) {
    const fields = {
        display_name: data.display_name,
        bio: data.bio,
        status: data.status
    };

    // Если передан avatar_file в формате data URL, сохраняем его и получаем URL для аватара
    // Если передан avatar_url, используем его напрямую
    if (typeof data.avatar_file === "string" && data.avatar_file.startsWith("data:")) {
        fields.avatar_url = saveDataUrl(data.avatar_file, "avatar");
    } else if (typeof data.avatar_url === "string") {
        fields.avatar_url = data.avatar_url;
    }

    const user = await userRepo.updateUser(userId, fields);
    const wallet = await walletRepo.getWallet(userId);
    const followers = await followRepo.getFollowers(userId);

    // Инвалидируем кэш ленты текущего пользователя, чтобы изменения профиля отразились в его ленте
    // Отобразится как "Обновил профиль" в ленте его подписчиков
    // Инвалидируем кэш ленты всех подписчиков, чтобы изменения профиля отразились в их ленте
    // Не реазовано на самом деле
    await feedService.invalidateFeed(userId); 
    for (const followerId of followers) {
        await feedService.invalidateFeed(followerId);
    }

    return {
        ...user,
        wallet_balance: Number(wallet?.balance || 0)
    };
}

module.exports = {
    getMyProfile,
    updateMyProfile
};
