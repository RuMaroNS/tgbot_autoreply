require('dotenv').config();
const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;

const bot = new Telegraf(BOT_TOKEN);
const TIMEZONE = 'Asia/Krasnoyarsk';

// Объект для хранения спам-счётчиков разных пользователей
// Структура будет такой: { "USER_ID": count }
const userSpamCount = {};

// База ответов ДНЕМ (с 09:00 до 02:00)
const busyResponses = [
    "{name}, здаров! Я сейчас занят делами, загляну позже. Текущее время у меня: {time}",
    "Привет, {name}! Я сейчас не у компа, ворвусь в сеть как освобожусь. У меня сейчас {time}",
    "{name}, на связи, но отошел по работе. Моё время: {time}. Напиши суть, отвечу позже!"
];

// База ответов НОЧЬЮ (когда ты спишь с 02:00 до 09:00)
const sleepResponses = [
    "Здаров, {name}. Я уже сто процентов сплю, так как у меня ночь. Время на часах: {time}. Отвечу как проснусь!",
    "Привет, {name}! Сейчас я сплю (моё время: {time}). Не теряй, утром буду в сети.",
    "{name}, у меня уже глухая ночь ({time}), так что я дрыхну. Напиши, что хотел, прочитаю утром!"
];

// База жестких ответов при флуде (больше 2 сообщений)
const spamResponses = [
    "{name}, братан, я ведь уже ясно сказал — Робона нет на месте. Он либо занят, либо спит.",
    "Перестань писать, {name}. Я всего лишь бот-секретарь. Сказано же — занят или спит!",
    "Хватит флудить, {name}, лимит терпения ИИ на исходе. Жди ответа.",
    "Твои сообщения доставлены, {name}, но от флуда Робон быстрее не освободится и не проснется. Отдыхай."
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Переменная-флаг, чтобы не переименовывать профиль каждую секунду
let isSleepPrefixSet = false;

// Функция проверки времени и обновления твоего имени в профиле
async function checkProfileName() {
    try {
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        
        const botInfo = await bot.telegram.getMe();
        let currentBotName = botInfo.first_name || "Автоответчик робона";

        // Время спать: с 2 ночи до 9 утра
        const isSleepTime = (currentHour >= 2 && currentHour < 9);

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

// Запускаем проверку времени каждые 60 секунд
setInterval(checkProfileName, 60000);


// Обработчик сообщений секретаря
bot.on('business_message', async (ctx) => {
    const msg = ctx.update.business_message;
    
    // Теперь реагируем на ЛЮБОЕ сообщение, если в нём есть отправитель
    if (msg && msg.from) {
        const chatId = msg.chat.id; 
        const connectionId = msg.business_connection_id;
        const userId = msg.from.id; // Уникальный ID написавшего нам человека
        
        // Достаем имя того, кто пишет
        const senderName = msg.from.first_name || "Бро";
        
        const now = moment().tz(TIMEZONE);
        const currentHour = now.hour();
        const formattedTime = now.format('HH:mm');

        // Инициализируем счётчик конкретно для ЭТОГО пользователя
        if (!userSpamCount[userId]) {
            userSpamCount[userId] = 0;
        }
        userSpamCount[userId]++;

        // Обертка для отправки
        const sendSecretarReply = async (text) => {
            try {
                await ctx.telegram.sendMessage(chatId, text, {
                    business_connection_id: connectionId
                });
            } catch (err) {
                console.error("Ошибка отправки через режим Секретаря:", err);
            }
        };

        // Логика выбора сообщений на основе личного счётчика пользователя
        if (userSpamCount[userId] <= 2) {
            if (currentHour >= 2 && currentHour < 9) {
                let response = getRandomElement(sleepResponses)
                    .replace('{name}', senderName)
                    .replace('{time}', formattedTime);
                await sendSecretarReply(response);
            } else {
                let response = getRandomElement(busyResponses)
                    .replace('{name}', senderName)
                    .replace('{time}', formattedTime);
                await sendSecretarReply(response);
            }
        } else {
            // Если именно этот пользователь флудит больше 2 раз
            const spamResponse = getRandomElement(spamResponses).replace('{name}', senderName);
            await sendSecretarReply(spamResponse);
        }

        // Сброс спам-счётчика конкретного человека через 15 минут тишины ОТ НЕГО
        clearTimeout(userSpamCount[`timeout_${userId}`]);
        userSpamCount[`timeout_${userId}`] = setTimeout(() => {
            userSpamCount[userId] = 0;
        }, 15 * 60 * 1000);
    }
});

bot.launch().then(() => {
    console.log('Бот-секретарь для ВСЕХ чатов успешно запущен!');
    check
