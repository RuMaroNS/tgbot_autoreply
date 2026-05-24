require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const bot = new Telegraf(process.env.BOT_TOKEN);
const TARGET_ID = Number(process.env.TARGET_USER_ID);

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

bot.on('business_message', async (ctx) => {
    const msg = ctx.update.business_message;
    
    if (msg && msg.from && msg.from.id === TARGET_ID) {
        const connectionId = msg.business_connection_id;
        const chatId = msg.chat.id; // ID чата с Беконом
        
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        const formattedTime = now.format('HH:mm');

        if (!userSpamCount[TARGET_ID]) {
            userSpamCount[TARGET_ID] = 0;
        }
        userSpamCount[TARGET_ID]++;

        // Функция для отправки сообщения СТРОГО через Business API
        const sendBusinessReply = async (text) => {
            try {
                await ctx.telegram.callApi('sendBusinessMessage', {
                    business_connection_id: connectionId,
                    chat_id: chatId,
                    text: text
                });
            } catch (err) {
                console.error("Ошибка отправки через Business API:", err);
            }
        };

        // Логика подбора фраз
        if (userSpamCount[TARGET_ID] <= 2) {
            if (currentHour >= 2 && currentHour < 9) {
                await sendBusinessReply(`Здаров, возможно я занят или сплю, сейчас время у меня ${formattedTime}`);
            } else {
                let response = getRandomElement(busyResponses).replace('{time}', formattedTime);
                await sendBusinessReply(response);
            }
        } else {
            const spamResponse = getRandomElement(spamResponses);
            await sendBusinessReply(spamResponse);
        }

        // Таймер сброса спам-счётчика
        clearTimeout(userSpamCount[`timeout_${TARGET_ID}`]);
        userSpamCount[`timeout_${TARGET_ID}`] = setTimeout(() => {
            userSpamCount[TARGET_ID] = 0;
        }, 15 * 60 * 1000);
    }
});

bot.launch().then(() => {
    console.log('Бот-автоответчик успешно запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
