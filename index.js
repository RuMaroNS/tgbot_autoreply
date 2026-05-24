require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);
const TIMEZONE = 'Asia/Krasnoyarsk';
const userSpamCount = {};

const busyResponses = [
    "{name}, здаров! Я сейчас занят делами, загляну позже. Текущее время у меня: {time}",
    "Привет, {name}! Я сейчас не у компа, ворвусь в сеть как освобожусь. У меня сейчас {time}",
    "{name}, на связи, но отошел по работе. Моё время: {time}. Напиши суть, отвечу позже!"
];

const sleepResponses = [
    "Здаров, {name}. Я уже сто процентов сплю, так как у меня ночь. Время на часах: {time}. Отвечу как проснусь!",
    "Привет, {name}! Сейчас я сплю (моё время: {time}). Не теряй, утром буду в сети.",
    "{name}, у меня уже глухая ночь ({time}), так что я дрыхну. Напиши, что хотел, прочитаю утром!"
];

const spamResponses = [
    "{name}, братан, я ведь уже ясно сказал — Робона нет на месте. Он либо занят, либо спит.",
    "Перестань писать, {name}. Я всего лишь бот-секретарь. Сказано же — занят или спит!",
    "Хватит флудить, {name}, лимит терпения ИИ на исходе. Жди ответа.",
    "Твои сообщения доставлены, {name}, но от флуда Робон быстрее не освободится и не проснется. Отдыхай."
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
let isSleepPrefixSet = false;

async function checkProfileName() {
    try {
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        
        const botInfo = await bot.telegram.getMe();
        let currentBotName = botInfo.first_name || "Автоответчик робона";
        const isSleepTime = (currentHour >= 2 || currentHour < 9);

        if (isSleepTime && !isSleepPrefixSet) {
            if (!currentBotName.includes('[Я Сплю]')) {
                const newName = `${currentBotName} [Я Сплю]`;
                await bot.telegram.callApi('setMyName', { name: newName });
                console.log(`[Профиль] Установлен статус сна. Новое имя: ${newName}`);
            }
            isSleepPrefixSet = true;
        } else if (!isSleepTime && isSleepPrefixSet) {
            if (currentBotName.includes('[Я Сплю]')) {
                const newName = currentBotName.replace(' [Я Сплю]', '').trim();
                await bot.telegram.callApi('setMyName', { name: newName });
                console.log(`[Профиль] Проснулся! Префикс убран. Новое имя: ${newName}`);
            }
            isSleepPrefixSet = false;
        }
    } catch (err) {
        console.error("Не удалось обновить имя в профиле:", err);
    }
}

setInterval(checkProfileName, 60000);

bot.on('business_message', async (ctx) => {
    const msg = ctx.update.business_message;
    
    if (msg && msg.from) {
        const chatId = msg.chat.id; 
        const connectionId = msg.business_connection_id;
        const userId = msg.from.id;
        const senderName = msg.from.first_name || "Бро";
        
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        const formattedTime = now.format('HH:mm');

        if (!userSpamCount[userId]) {
            userSpamCount[userId] = 0;
        }
        userSpamCount[userId]++;

        const sendSecretarReply = async (text) => {
            try {
                await ctx.telegram.sendMessage(chatId, text, {
                    business_connection_id: connectionId
                });
            } catch (err) {
                console.error("Ошибка отправки через режим Секретаря:", err);
            }
        };

        if (userSpamCount[userId] <= 2) {
            if (currentHour >= 2 || currentHour < 9) {
                let response = getRandomElement(sleepResponses).replace('{name}', senderName).replace('{time}', formattedTime);
                await sendSecretarReply(response);
            } else {
                let response = getRandomElement(busyResponses).replace('{name}', senderName).replace('{time}', formattedTime);
                await sendSecretarReply(response);
            }
        } else {
            const spamResponse = getRandomElement(spamResponses).replace('{name}', senderName);
            await sendSecretarReply(spamResponse);
        }

        clearTimeout(userSpamCount[`timeout_${userId}`]);
        userSpamCount[`timeout_${userId}`] = setTimeout(() => {
            userSpamCount[userId] = 0;
        }, 15 * 60 * 1000);
    }
});

bot.launch().then(() => {
    console.log('Бот-секретарь запущен!');
    checkProfileName();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
