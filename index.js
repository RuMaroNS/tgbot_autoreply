require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const bot = new Telegraf(process.env.BOT_TOKEN);
const TARGET_ID = Number(process.env.TARGET_USER_ID);

// Временная зона Красноярска
const TIMEZONE = 'Asia/Krasnoyarsk';

// Объект для отслеживания количества спама от Бекона во время одной "сессии" отсутствия
// В реальном проекте лучше использовать базу/redis, но для памяти процесса пойдет
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

// Функция для выбора случайного элемента из массива
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Обработчик бизнес-сообщений (когда пишут на твой аккаунт, где подключен бот)
bot.on('business_message', async (ctx) => {
    const msg = ctx.businessMessage;
    
    // Проверяем, что написал именно Бекон
    if (msg.from && msg.from.id === TARGET_ID) {
        
        // Получаем текущее время в Красноярске
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        const formattedTime = now.format('HH:mm');

        // Инициализируем или увеличиваем счетчик сообщений
        if (!userSpamCount[TARGET_ID]) {
            userSpamCount[TARGET_ID] = 0;
        }
        userSpamCount[TARGET_ID]++;

        // Если это первый или второй засыл — отвечаем вежливо по времени
        if (userSpamCount[TARGET_ID] <= 2) {
            
            // Если время от 2:00 до 9:00 (включая 2:00 и до 8:59) -> Спим
            if (currentHour >= 2 && currentHour < 9) {
                await ctx.reply(`Здаров, возможно я занят или сплю, сейчас время у меня ${formattedTime}`);
            } else {
                // В остальное время -> Занят (выбираем рандомную фразу)
                let response = getRandomElement(busyResponses);
                response = response.replace('{time}', formattedTime);
                await ctx.reply(response);
            }
            
        } else {
            // Если пишет 3-й раз и больше — включаем режим деда
            const spamResponse = getRandomElement(spamResponses);
            await ctx.reply(spamResponse);
        }

        // Сбрасываем счетчик спама через 15 минут тишины, чтобы при следующем диалоге бот снова ответил вежливо
        clearTimeout(userSpamCount[`timeout_${TARGET_ID}`]);
        userSpamCount[`timeout_${TARGET_ID}`] = setTimeout(() => {
            userSpamCount[TARGET_ID] = 0;
        }, 15 * 60 * 1000);
    }
});

// Запуск
bot.launch().then(() => {
    console.log('Бот-автоответчик успешно запущен!');
});

// Корректная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
