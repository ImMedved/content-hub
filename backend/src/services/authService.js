/*
Auth service
- register user
- login user
- password hashing
- jwt generation
- session storage

- jwt + sessions
*/

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userRepo = require("../repositories/userRepository");
const roleRepo = require("../repositories/roleRepository");
const sessionRepo = require("../repositories/sessionRepository");
const walletRepo = require("../repositories/walletRepository");
const { getEmailHash, normalizeEmail } = require("../utils/emailSecurity");

// register
async function register(data) {
    const { username, email, password } = data; // деструктуризация объекта data, чтобы получить username, email и password
    const normalizedEmail = normalizeEmail(email); // нормализуем email, чтобы избежать дубликатов из-за регистра или точек
    const emailHash = getEmailHash(normalizedEmail); // хэшируем email, чтобы не хранить его в открытом виде в базе данных

    const passwordHash = await bcrypt.hash(password, 10); // хэшируем пароль с солью (10 раундов), чтобы хранить его безопасно в базе данных
    // создаем пользователя в базе данных с хэшированным паролем и хэшированным email
    const userId = await userRepo.createUser({
        username,
        emailHash,
        passwordHash
    });
    // присваиваем пользователю роль "user" и создаем кошелек с балансом 100
    const role = await roleRepo.getRoleByName("user");

    await roleRepo.assignRole(userId, role.id);
    await walletRepo.createWallet(userId, 100);

    return { userId };
}

// login
// проверяем email и пароль, если они верны, то создаем JWT и сохраняем сессию в базе данных
// JWT (JSON Web Token) - это токен, который содержит информацию о пользователе и подписан секретным ключом. Он используется для аутентификации пользователя на фронтенде.
async function login(data) {
    const { email, password } = data;
    const emailHash = getEmailHash(email); // хэшируем email, чтобы найти пользователя в базе данных по хэшу, а не по открытому email

    const user = await userRepo.findByEmailHash(emailHash); // ищем пользователя в базе данных по хэшу email

    if (!user) throw new Error("User not found");

    const valid = await bcrypt.compare(password, user.password_hash); 
    // сравниваем введенный пароль с хэшированным паролем из базы данных. 
    // bcrypt.compare() возвращает true, если пароли совпадают, и false, если нет.
    if (!valid) throw new Error("Invalid password");

    // создаем JWT с userId и секретным ключом из переменных окружения, срок действия токена 1 день
    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    // сохраняем сессию в базе данных, чтобы можно было проверять токен на сервере и отзывать его при необходимости
    // Это дает возможность отозвать токен, если пользователь вышел из системы или если токен был скомпрометирован.
    await sessionRepo.createSession(user.id, token);

    return { token };
}

// экспортируем функции register и login, чтобы их можно было использовать в контроллерах
module.exports = {
    register,
    login
};
