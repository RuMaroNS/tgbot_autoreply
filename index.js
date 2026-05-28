require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const TIMEZONE = 'Asia/Krasnoyarsk';
// СЮДА ВПИШИ СВОЙ ЦИФРОВОЙ TELEGRAM ID, ЧТОБЫ БОТ СЛУШАЛСЯ ТОЛЬКО ТЕБЯ
const MY_TELEGRAM_ID = 6176762600; 

const userSpamCount = {};

// Флаги ручного переключения
let manualSleepMode = null; // null - авто, true - принудительный сон, false - принудительный бодр

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
    "{name}, тормози, тебе же сказали — Робона нет на месте. Хватит спамить.",
    "Не флуди, {name}. Сообщения доставлены, но от спама я быстрее не отвечу. Отдыхай.",
    "Хватит стучать в закрытые двери, {name}. Сказано же: либо занят, либо сплю. Жди."
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Функция проверки времени (ночь с 2 до 9 утра)
function isItNightTime() {
    const now = moment().tz(TIMEZONE);
    const currentHour = now.hour();
    return (currentHour >= 2 && currentHour < 9);
}

// Управление префиксом в названии профиля
async function updateProfileName() {
    try {
        // Определяем, должен ли бот сейчас "спать" (учитываем ручной режим)
        let shouldSleep = false;
        if (manualSleepMode !== null) {
            shouldSleep = manualSleepMode;
        } else {
            shouldSleep = isItNightTime();
        }

        const botInfo = await bot.telegram.getMe();
        let currentBotName = botInfo.first_name || "Автоответчик";

        if (shouldSleep && !currentBotName.includes('[Я сплю]')) {
            const newName = `${currentBotName.replace(' [Я сплю]', '').trim()} [Я сплю]`;
            await bot.telegram.callApi('setMyName', { name: newName });
            console.log(`[Профиль] Режим сна активен. Имя изменено на: ${newName}`);
        } else if (!shouldSleep && currentBotName.includes('[Я сплю]')) {
            const newName = currentBotName.replace(' [Я сплю]', '').trim();
            await bot.telegram.callApi('setMyName', { name: newName });
            console.log(`[Профиль] Проснулся! Имя изменено на: ${newName}`);
        }
    } catch (err) {
        console.error("Не удалось обновить имя в профиле:", err);
    }
}

// Чекаем профиль раз в минуту для автоматического режима
setInterval(updateProfileName, 60000);

// Обработка команд в ЛС (управление режимами)
bot.command('sleep', async (ctx) => {
    if (ctx.from.id !== MY_TELEGRAM_ID) return;
    manualSleepMode = true;
    await ctx.reply("Включен принудительный режим сна [Я сплю]. Автоматика по времени отключена.");
    await updateProfileName();
});

bot.command('unsleep', async (ctx) => {
    if (ctx.from.id !== MY_TELEGRAM_ID) return;
    manualSleepMode = null; // Возвращаем на авто
    await ctx.reply("Принудительный режим отключен. Бот снова работает по обычному времени.");
    await updateProfileName();
});

// Работа в бизнес-чатах
bot.on('business_message', async (ctx) => {
    const msg = ctx.update.business_message;
    
    if (msg && msg.from) {
        // Игнорируем сообщения от самого себя, чтобы бот не отвечал на свои же реплики
        if (msg.from.id === MY_TELEGRAM_ID) return;

        const chatId = msg.chat.id; 
        const connectionId = msg.business_connection_id;
        const userId = msg.from.id;
        const senderName = msg.from.first_name || "Бро";
        
        const now = moment().tz(TIMEZONE);
        const formattedTime = now.format('HH:mm');

        // Считаем спам
        if (!userSpamCount[userId]) {
            userSpamCount[userId] = 0;
        }
        userSpamCount[userId]++;

        // Логика выбора текста
        let responseText = "";
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

        // Задержка перед ответом (от 3 до 7 секунд), чтобы имитировать человека
        const delay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;

        setTimeout(async () => {
            try {
                // Отправляем ответ
                const sentMsg = await ctx.telegram.sendMessage(chatId, responseText, {
                    business_connection_id: connectionId
                });

                // Очередь на удаление через 5 минут (5 * 60 * 1000 мс)
                setTimeout(async () => {
                    try {
                        await ctx.telegram.deleteMessage(chatId, sentMsg.message_id);
                        console.log(`[Удаление] Сообщение для ${senderName} успешно удалено через 5 минут.`);
                    } catch (delErr) {
                        console.error("Не удалось удалить сообщение (возможно, пользователь его уже стёр):", delErr);
                    }
                }, 5 * 60 * 1000);

            } catch (err) {
                console.error("Ошибка отправки бизнес-сообщения:", err);
            }
        }, delay);

        // Сброс счетчика спама, если человек молчит 15 минут
        clearTimeout(userSpamCount[`timeout_${userId}`]);
        userSpamCount[`timeout_${userId}`] = setTimeout(() => {
            userSpamCount[userId] = 0;
        }, 15 * 60 * 1000);
    }
});

// Старт
bot.launch().then(() => {
    console.log('Бизнес-бот успешно запущен и готов к работе!');
    updateProfileName();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
