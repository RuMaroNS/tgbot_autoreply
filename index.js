require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;
const TARGET_ID = Number(process.env.TARGET_USER_ID);

const bot = new Telegraf(BOT_TOKEN);
const TIMEZONE = 'Asia/Krasnoyarsk';
const userSpamCount = {};

const busyResponses = [
    "Здаров, я сейчас занят делами, загляну позже. Текущее время у меня: {time}",
    "Привет! Я сейчас не у компа, ворвусь в сеть как освобожусь. У меня сейчас {time}",
    "На связи, но отошел по работе. Моё время: {time}. Напиши суть, отвечу позже!"
];

const spamResponses = [
    "Братан, я ведь уже ясно сказал, Робона нет в сети — он либо занят, либо спит.",
    "Перестань писать, я всего лишь бот, обслуживающий чат, пока Робона нет на месте.",
    "Хватит флудить, лимит терпения ИИ на исходе. Сказано же — занят или спит!",
    "Твои сообщения доставлены, но Робон от этого быстрее не проснется/не освободится. Жди."
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Секретарь перехватывает сообщения через событие 'business_message'
bot.on('business_message', async (ctx) => {
    const msg = ctx.update.business_message;
    
    if (msg && msg.from && msg.from.id === TARGET_ID) {
        const chatId = msg.chat.id; // ID чата, куда пришло сообщение
        
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        const formattedTime = now.format('HH:mm');

        if (!userSpamCount[TARGET_ID]) {
            userSpamCount[TARGET_ID] = 0;
        }
        userSpamCount[TARGET_ID]++;

        // Функция отправки через стандартный sendMessage в целевой чат
        const sendSecretarReply = async (text) => {
            try {
                await ctx.telegram.sendMessage(chatId, text);
            } catch (err) {
                console.error("Ошибка отправки через режим Секретаря:", err);
            }
        };

        // Логика подбора фраз
        if (userSpamCount[TARGET_ID] <= 2) {
            if (currentHour >= 2 && currentHour < 9) {
                await sendSecretarReply(`Здаров, возможно я занят или сплю, сейчас время у меня ${formattedTime}`);
            } else {
                let response = getRandomElement(busyResponses).replace('{time}', formattedTime);
                await sendSecretarReply(response);
            }
        } else {
            const spamResponse = getRandomElement(spamResponses);
            await sendSecretarReply(spamResponse);
        }

        // Таймер сброса спам-счётчика через 15 минут тишины
        clearTimeout(userSpamCount[`timeout_${TARGET_ID}`]);
        userSpamCount[`timeout_${TARGET_ID}`] = setTimeout(() => {
            userSpamCount[TARGET_ID] = 0;
        }, 15 * 60 * 1000);
    }
});

bot.launch().then(() => {
    console.log('Бот-секретарь успешно запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
