const redisClient = require("../config/redis");
const { createRedisSubscriberIfAvailable } = require("../config/redis");

const listenersByUser = new Map();
const versionByUser = new Map();

// Helper functions to generate Redis keys
function getVersionKey(userId) {
    return `messages:user:${userId}:version`;
}

// Helper function to generate Redis channel name for user messages
function getChannelName(userId) {
    return `messages:user:${userId}:events`;
}

// Добавляем слушателя для уведомлений о новых сообщениях пользователя. Возвращает функцию для удаления слушателя.
// Слушатель это функция, которая будет вызвана, когда произойдет событие уведомления для данного пользователя.
// Она вызывается автоматически, когда вызывается notifyUsers с идентификатором пользователя, на которого подписан слушатель.
function addListener(userId, listener) {
    const key = String(userId);
    const listeners = listenersByUser.get(key) || new Set();
    listeners.add(listener);
    listenersByUser.set(key, listeners);
    // Возвращаем функцию для удаления слушателя
    // Если слушатель был удален, и больше нет слушателей для этого пользователя, удаляем запись из listenersByUser
    return () => {
        const currentListeners = listenersByUser.get(key);

        if (!currentListeners) {
            return;
        }

        currentListeners.delete(listener);

        if (currentListeners.size === 0) {
            listenersByUser.delete(key);
        }
    };
}

// Уведомляем пользователей о новых сообщениях. Увеличиваем версию сообщений пользователя и уведомляем всех подписанных слушателей.
// Если Redis доступен, используем его для уведомлений, иначе используем локальные слушатели. 
// Эта функция вызывается, когда пользователь получает новое сообщение, чтобы уведомить его и всех подписанных слушателей о новом сообщении.
async function notifyUsers(userIds) {
    const uniqueUserIds = [...new Set(userIds.map((item) => String(item)))];

    if (redisClient.isOpen) {
        try {
            const pipeline = redisClient.multi();

            for (const userId of uniqueUserIds) {
                pipeline.incr(getVersionKey(userId));
                pipeline.publish(getChannelName(userId), "message");
            }

            await pipeline.exec();
            return;
        } catch (err) {
            console.warn("Redis message notify failed, falling back to local listeners:", err.message);
        }
    }

    for (const userId of uniqueUserIds) {
        versionByUser.set(userId, (versionByUser.get(userId) || 0) + 1); // Увеличиваем локальную версию сообщений пользователя
        // versionByUser это Map, который хранит текущую версию сообщений для каждого пользователя. 
        // То есть каждый раз, когда пользователь получает новое сообщение, его версия увеличивается на 1.

        const listeners = listenersByUser.get(userId);

        if (!listeners) {
            continue;
        }
        // Создаем копию массива слушателей, чтобы избежать проблем с изменением коллекции во время итерации
        for (const listener of [...listeners]) {
            listener();
        }
    }
}

// Получаем текущую версию сообщений пользователя. Если Redis доступен, используем его, иначе используем локальную версию.
// Эта функция вызывается, когда пользователь запрашивает свои сообщения, чтобы узнать, есть ли новые сообщения с момента последнего запроса.
// После получения версии сообщений, клиент может сравнить ее с версией, которую он получил при последнем запросе, чтобы определить, есть ли новые сообщения.
// Если сообщения были получены, клиент может вызвать waitForUserUpdate, чтобы дождаться новых сообщений.
async function getUserVersion(userId) {
    if (redisClient.isOpen) {
        try {
            const version = await redisClient.get(getVersionKey(userId));
            return Number(version || 0);
        } catch (err) {
            console.warn("Redis message version read failed, using local version:", err.message);
        }
    }

    return versionByUser.get(String(userId)) || 0;
}

async function waitForLocalUserUpdate(userId, sinceVersion, timeoutMs) {
    if ((versionByUser.get(String(userId)) || 0) > sinceVersion) { // Если текущая версия сообщений пользователя больше, чем версия, с которой мы начали ожидание, 
    // значит, есть новые сообщения, и мы можем сразу вернуть управление.
        return;
    }

    // Промис это объект, который представляет результат асинхронной операции. 
    // Он может быть в одном из трех состояний: ожидание (pending), выполнено (fulfilled) или отклонено (rejected).
    // Тут мы создаем промис, который будет выполнен, когда произойдет событие уведомления для данного пользователя или истечет таймаут.
    return new Promise((resolve) => {
        let timeoutId = null;
        let unsubscribe = null;

        // Функция finish вызывается, когда происходит событие уведомления для данного пользователя или истекает таймаут.
        // Она выполняет очистку таймаута и отписку от уведомлений, а затем выполняет промис.
        const finish = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (unsubscribe) {
                unsubscribe();
            }

            resolve();
        };

        unsubscribe = addListener(userId, finish);
        timeoutId = setTimeout(finish, timeoutMs);
    });
}

async function waitForUserUpdate(userId, sinceVersion, timeoutMs = 25000) {
    const currentVersion = await getUserVersion(userId);

    if (currentVersion > sinceVersion) {
        return;
    }

    if (!redisClient.isOpen) {
        await waitForLocalUserUpdate(userId, sinceVersion, timeoutMs);
        return;
    }

    const subscriber = await createRedisSubscriberIfAvailable();

    if (!subscriber) {
        await waitForLocalUserUpdate(userId, sinceVersion, timeoutMs);
        return;
    }

    await new Promise((resolve) => {
        let completed = false;
        let timeoutId = null;

        const finish = async () => {
            if (completed) {
                return;
            }

            completed = true;

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            try {
                await subscriber.unsubscribe(getChannelName(userId));
            } catch (err) {
            }

            try {
                await subscriber.quit();
            } catch (err) {
            }

            resolve();
        };

        timeoutId = setTimeout(() => {
            finish();
        }, timeoutMs);

        try {
            subscriber.subscribe(getChannelName(userId), async () => {
                await finish();
            }).catch(async () => {
                await finish();
            });
        } catch (err) {
            console.warn("Redis message subscription failed, using timeout fallback:", err.message);
            finish();
        }
    });
}

module.exports = {
    getUserVersion,
    notifyUsers,
    waitForUserUpdate
};
