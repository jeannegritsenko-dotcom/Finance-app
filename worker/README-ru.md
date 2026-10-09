# Эмодзи-статус в Monvelly — запуск воркера (бесплатно, ~5 минут)

1. Зайти на dash.cloudflare.com, зарегистрироваться (карта не нужна).
2. Workers & Pages → Create → Create Worker → назвать `monvelly-emoji` → Deploy.
3. Edit code → удалить всё, вставить содержимое файла `worker/worker.js` → Deploy.
4. Settings → Variables and Secrets → Add → тип **Secret**, имя `BOT_TOKEN`, значение — токен бота из @BotFather → Deploy.
5. Скопировать адрес воркера (вида https://monvelly-emoji.ИМЯ.workers.dev) и прислать мне. Я вставлю его в приложение.
6. Открыть бота и нажать «Старт» (иначе Telegram не отдаст статус).

Токен хранится только в Cloudflare. В приложение и в GitHub он не попадает.
