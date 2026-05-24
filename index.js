require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const bot = new Telegraf(process.env.BOT_TOKEN);
const TARGET_ID = Number(process.env.TARGET_USER_ID);

// Временная зона Красноярска
const TIMEZONE = 'Asia/Krasnoyarsk';

// Объект для отслеживания количества спама от Бекона
const userSpamCount = {};

// База ответов для первого сообщения в зависимости от времени
const busyResponses = [
    "Здаров, я сейчас занят делами, загляну позже. Текущее время у меня: {time}",
    "Привет! Я сейчас не у компа, ворвусь в сеть как освобожусь. У меня сейчас {time}",
    "На связи, но отошел по работе. Моё время: {time}. Напиши суть, отвечу позже!"
];

// База жестких ответов, если Бекон начинает спамить
const spamResponses = [
    "Братан, я ведь уже ясно сказал, Робона нет в сети — он либо занят, либо спит.",
    "Перестань писать, я всего лишь бот, обслуживающий чат, пока Робона нет на месте.",
    "Хватит флудить, лимит терпения ИИ на исходе. Сказано же — занят или спит!",
    "Твои сообщения доставлены, но Робон от этого быстрее не проснется/не освободится. Жди."
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Правильный обработчик для Telegraf v4
bot.on('business_message', async (ctx) => {
    // В Telegraf объект сообщения лежит в ctx.update.business_message
    const msg = ctx.update.business_message;
    
    // Проверяем, что сообщение существует и написано именно Беконом
    if (msg && msg.from && msg.from.id === TARGET_ID) {
        
        // ID бизнес-подключения (критично для отправки ответа от твоего имени!)
        const connectionId = msg.business_connection_id;
        
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        const formattedTime = now.format('HH:mm');

        if (!userSpamCount[TARGET_ID]) {
            userSpamCount[TARGET_ID] = 0;
        }
        userSpamCount[TARGET_ID]++;

        // Опции отправки: обязательно привязываем к бизнес-подключению
        const replyOptions = { business_connection_id: connectionId };

        if (userSpamCount[TARGET_ID] <= 2) {
            if (currentHour >= 2 && currentHour < 9) {
                await ctx.reply(`Здаров, возможно я занят или сплю, сейчас время у меня ${formattedTime}`, replyOptions);
            } else {
                let response = getRandomElement(busyResponses).replace('{time}', formattedTime);
                await ctx.reply(response, replyOptions);
            }
        } else {
            const spamResponse = getRandomElement(spamResponses);
            await ctx.reply(spamResponse, replyOptions);
        }

        // Сброс счетчика через 15 минут
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
