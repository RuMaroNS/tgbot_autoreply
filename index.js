require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const TIMEZONE = 'Asia/Krasnoyarsk';
// Твой Telegram ID
const MY_TELEGRAM_ID = 6176762600; 

// Хранилище бизнес-соединения для управления твоим личным профилем
let activeBusinessConnectionId = null;

const userSpamCount = {};
let manualSleepMode = null; // null - авто по времени, true - принудительный сон, false - принудительный бодр

const busyResponses = [
    "Йоу, {name}! Я сейчас по делам отчалил, буду позже. На часах у меня: {time}",
    "Привет, {name}. Сейчас не у компа, ворвусь в сеть как раскидаю задачи. Моё время: {time}",
    "{name}, на связи, но занят важным делом. Время: {time}. Напиши суть, освобожусь — отвечу!"
];

const sleepResponses = [
    "Здарова, {name}. Я уже в царстве снов, у меня глубокая ночь. На часах: {time}. Проснусь — наберу.",
    "Привет, {name}! Я сейчас дрыхну (моё время: {time}). Не теряй, утром буду в сети.",
    "{name}, у меня уже ночь ({time}), так что я сплю. Оставляй мессадж, утром чекну!"
];

const spamResponses = [
    "{name}, тормози, тебе же сказали — меня нет на месте. Хватит спамить.",
    "Не флуди, {name}. Сообщения доставлены, но от спама я быстрее не отвечу. Отдыхай."
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

function isItNightTime() {
    const now = moment().tz(TIMEZONE);
    const currentHour = now.hour();
    // Ночь с 2 до 9 утра
    return (currentHour >= 2 && currentHour < 9);
}

// Изменение имени ТВОЕГО личного профиля через правильный метод API
async function updateProfileName() {
    if (!activeBusinessConnectionId) {
        console.log("[Профиль] Жду первого входящего сообщения в бизнес-чатах, чтобы перехватить управление твоим профилем...");
        return;
    }

    try {
        let shouldSleep = (manualSleepMode !== null) ? manualSleepMode : isItNightTime();

        // Твой базовый ник
        const baseName = "Просто человек"; 
        const newName = shouldSleep ? `${baseName} [Я сплю]` : baseName;

        // Исправлено: используем стандартный setMyName, но прокидываем business_connection_id
        await bot.telegram.callApi('setMyName', {
            business_connection_id: activeBusinessConnectionId,
            name: newName
        });
        console.log(`[Профиль] Имя твоего личного аккаунта изменено на: ${newName}`);
    } catch (err) {
        console.error("Не удалось обновить имя в твоем профиле:", err);
    }
}

// Проверка и обновление каждую минуту
setInterval(updateProfileName, 60000);

// Управление командами в твоем ЛС с ботом
bot.command('sleep', async (ctx) => {
    if (ctx.from.id !== MY_TELEGRAM_ID) return;
    manualSleepMode = true;
    await ctx.reply("Включен принудительный режим сна [Я сплю]. Автоматика отключена.");
    await updateProfileName();
});

bot.command('unsleep', async (ctx) => {
    if (ctx.from.id !== MY_TELEGRAM_ID) return;
    manualSleepMode = null;
    await ctx.reply("Принудительный режим отключен. Бот снова работает по времени.");
    await updateProfileName();
});

// Работа в бизнес-чатах (когда пишут тебе другие люди)
bot.on('business_message', async (ctx) => {
    const msg = ctx.update.business_message;
    
    if (msg && msg.from) {
        // Игнорируем твои собственные сообщения в чатах
        if (msg.from.id === MY_TELEGRAM_ID) return;

        const chatId = msg.chat.id; 
        const connectionId = msg.business_connection_id;
        const userId = msg.from.id;
        const senderName = msg.from.first_name || "Бро";
        
        // Перезаписываем ID соединения, чтобы бот всегда имел актуальный доступ к твоему профилю
        activeBusinessConnectionId = connectionId;

        const now = moment().tz(TIMEZONE);
        const formattedTime = now.format('HH:mm');
        const userText = (msg.text || "").toLowerCase().trim();

        if (!userSpamCount[userId]) {
            userSpamCount[userId] = 0;
        }
        userSpamCount[userId]++;

        let responseText = "";

        // Секретный триггер на фразу "Твое время"
        if (userText === "твое время" || userText === "твоё время") {
            responseText = `Слышь, раз уж ты спрашиваешь... Моё точное время прямо сейчас: ${formattedTime}. Больше не теряй его.`;
        } else {
            // Обычный ответ (занят / спит / спам)
            if (userSpamCount[userId] <= 2) {
                const activeSleep = (manualSleepMode !== null) ? manualSleepMode : isItNightTime();
                if (activeSleep) {
                    responseText = getRandomElement(sleepResponses).replace('{name}', senderName).replace('{time}', formattedTime);
                } else {
                    responseText = getRandomElement(busyResponses).replace('{name}', senderName).replace('{time}', formattedTime);
                }
            } else {
                responseText = getRandomElement(spamResponses).replace('{name}', senderName);
            }
        }

        // Рандомная задержка ответа перед отправкой (от 3 до 7 секунд)
        const delay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;

        setTimeout(async () => {
            try {
                const sentMsg = await ctx.telegram.sendMessage(chatId, responseText, {
                    business_connection_id: connectionId
                });

                // Удаление сообщения автоответчика ровно через 5 минут
                setTimeout(async () => {
                    try {
                        await ctx.telegram.deleteMessage(chatId, sentMsg.message_id);
                        console.log(`[Удаление] Сообщение для ${senderName} удалено через 5 минут.`);
                    } catch (delErr) {
                        console.error("Не удалось удалить сообщение:", delErr);
                    }
                }, 5 * 60 * 1000);

            } catch (err) {
                console.error("Ошибка отправки бизнес-сообщения:", err);
            }
        }, delay);

        // Таймер сброса флуд-лимита (15 минут тишины от юзера)
        clearTimeout(userSpamCount[`timeout_${userId}`]);
        userSpamCount[`timeout_${userId}`] = setTimeout(() => {
            userSpamCount[userId] = 0;
        }, 15 * 60 * 1000);
    }
});

// Старт бота
bot.launch().then(() => {
    console.log('Бизнес-автоответчик успешно запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
