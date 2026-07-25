const express = require("express");
const cors = require("cors"); // разрешение кросс-доменных запросов
const path = require("path");
const db = require("./db/db");

const app = express(); 
const frontendDistPath = path.join(__dirname, "../../frontend/content-platform-ui/dist"); // путь к статическим файлам фронтенда

// middleware
// функции, которые выполняются до попадания запроса в обработчик
// Запрос - express.json() - cors() - auth middleware - router - ответ

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "64mb" }));
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "../uploads"))); 
// путь к статическим файлам для загрузки изображений
// пользователь загрузил файл - браузер сможет его открыть и сам прочитать, если знает путь к нему

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const followRoutes = require("./routes/followRoutes");
const feedRoutes = require("./routes/feedRoutes");
const commentRoutes = require("./routes/commentRoutes");
const reactionRoutes = require("./routes/reactionRoutes");
const messageRoutes = require("./routes/messageRoutes");
const mediaRoutes = require("./routes/mediaRoutes");

const API_PREFIX = "/api/v1"; // префикс для всех маршрутов API

// routes
// если запрос пришел на /api/v1/auth, то он попадет в authRoutes
// например, POST /api/v1/auth/login попадет в authRoutes.post("/login", loginController)
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/posts`, postRoutes);
app.use(`${API_PREFIX}/follow`, followRoutes);
app.use(`${API_PREFIX}/feed`, feedRoutes);
app.use(`${API_PREFIX}/comments`, commentRoutes);
app.use(`${API_PREFIX}/reactions`, reactionRoutes);
app.use(`${API_PREFIX}/messages`, messageRoutes);
app.use(`${API_PREFIX}/media`, mediaRoutes);

// Это endpoint для проверки, что приложение живо
app.get("/health", async (req, res) => {
    try {
        // выполняем простой запрос к sql базе данных, чтобы проверить соединение
        const [rows] = await db.query("SELECT 1 + 1 AS result");
        res.json({ status: "ok", db: rows[0]?.result === 2 ? "ok" : "unknown" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Во время запуска тестов React не нужен, поэтому вся логика обслуживания frontend отключается.
if (process.env.NODE_ENV !== "test" && process.env.SERVE_FRONTEND !== "false") {
    app.use(express.static(frontendDistPath)); // Express будет обслуживать статические файлы из папки dist фронтенда
    // То есть dist/assets/main.js будет доступен по адресу http://server:port/assets/main.js

    app.get(/^(?!\/api\/v1|\/uploads|\/health).*/, (req, res, next) => {
        // Если запрос не начинается с /api/v1, /uploads или /health, то это запрос к фронтенду
        // Возвращаем index.html, чтобы React Router мог обработать маршрут на фронтенде
        res.sendFile(path.join(frontendDistPath, "index.html"), (err) => {
            if (err) {
                next();
            }
        });
        // Предположим, пользователь открыл http://localhost:5000/profile/25. С точки зрения сервера нет файла /profile/25.
        // Без этого кода сервер вернет 404. Но React Router на фронтенде знает, что /profile/25 - это маршрут, который нужно обработать.
    });
}

module.exports = app;
