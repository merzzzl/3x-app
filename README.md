# 3X APP

Telegram Mini App для управления конфигурациями в 3X-UI v3.8.5. Один Node.js-сервер обслуживает API и веб-интерфейс на HTML, CSS и JavaScript.

## Возможности

- Авторизация через подписанные Telegram `initData`.
- Заявки на доступ с кнопками «Подтвердить» и «Отклонить» в чате администратора.
- Группа `<tg_id>@3x.local` создаётся только после подтверждения.
- Четыре типа клиентов: TLS (VLESS + Trojan + Hysteria), MTProto, WireGuard и AmneziaWG.
- Общий лимит — 10 клиентов, в любом сочетании, включая несколько клиентов одного типа.
- Все новые клиенты получают адрес `<uuid>@3x.local`.
- Открытие страницы подписки и удаление конфигураций.

Клиенты и группы загружаются из 3X-UI. Приложение не хранит их копию и не восстанавливает удалённую группу автоматически. Все клиенты учитываются в общем лимите. Старые клиенты `<tg_id>@3x.local` остаются доступны и также занимают одно место. Их inbound’ы автоматически не изменяются; прежняя связка отображается с бейджами TLS и MTProto.

## Запуск

Требуется Node.js 24 или новее.

```sh
npm ci
npm run dev
```

Перед запуском создайте локальный `.env` по примеру ниже. Подставьте собственные адреса, токены, Telegram ID и ID существующих inbound’ов.

```dotenv
NODE_ENV=development
PORT=8081
APP_ORIGIN=http://localhost:8081
TRUST_PROXY_HOPS=0

TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
TELEGRAM_ADMIN_IDS=
APPROVALS_FILE=./data/approvals.json

XUI_URL=https://panel.example.com/secret-path/
XUI_API_TOKEN=
XUI_SUBSCRIPTION_URL=https://subscription.example.com/sub/
XUI_VLESS_INBOUND_ID=1
XUI_TROJAN_INBOUND_ID=7
XUI_HYSTERIA_INBOUND_ID=2
XUI_MTPROTO_INBOUND_ID=3
XUI_WIREGUARD_INBOUND_ID=8
XUI_AMNEZIAWG_INBOUND_ID=4
```

`XUI_URL` — базовый адрес панели, включая её префикс пути, без `/panel/api`. `XUI_SUBSCRIPTION_URL` — базовый адрес страницы подписки без идентификатора клиента. Пустой ID WireGuard или AmneziaWG отключает соответствующий вариант создания.

`TELEGRAM_ADMIN_CHAT_ID` — чат для заявок. `TELEGRAM_ADMIN_IDS` — Telegram ID пользователей, которым разрешено подтверждать заявки, через запятую. Для личного чата администратор должен сначала отправить боту `/start`.

Для открытия через Telegram опубликуйте сервер по HTTPS, укажите этот адрес без завершающего слеша в `APP_ORIGIN` и настройте кнопку меню Mini App через BotFather. За одним доверенным reverse proxy установите `TRUST_PROXY_HOPS=1`; без него оставьте `0`. При смене адреса временного туннеля обновите `.env`, кнопку бота и перезапустите сервер.

Обычное открытие страницы в браузере не заменяет вход через Telegram. Сервер проверяет подпись и срок действия `initData`.

## Эксплуатация

```sh
npm run check
npm run build
npm start
```

В production установите `NODE_ENV=production`. Для запуска нужны `dist/`, `public/`, `package.json`, установленные production-зависимости и `.env`. Команды выполняются из корня проекта. Проверка доступности: `GET /api/health`.

Запускайте один экземпляр приложения: обработчик подтверждений использует Telegram long polling, а блокировки операций находятся в памяти процесса. Бот не должен одновременно использовать webhook или другой обработчик `getUpdates`.

`data/approvals.json` хранит заявки, результаты решений и позицию Telegram polling. Сохраняйте каталог `data/` между перезапусками. Это служебное состояние доступа, а не база VPN-конфигураций.

`.env`, `data/`, зависимости, сборка и логи исключены из Git. Токены передаются только серверу.

## Структура

- `src/auth/` — проверка авторизации Telegram.
- `src/access/` — заявки и решения администратора.
- `src/telegram/` — Bot API и обработка кнопок.
- `src/panel/` — клиент API 3X-UI.
- `src/profiles/` — получение, создание и удаление конфигураций.
- `public/` — интерфейс Mini App.

`npm run format` форматирует исходники. `npm run check` проверяет TypeScript и синтаксис браузерного JavaScript без обращений к панели.

## Docker и CI

GitHub Actions собирает образ для `linux/amd64` и `linux/arm64`. При push в `main` публикуются `ghcr.io/merzzzl/x3-bot-app:latest` и тег коммита `sha-…`. Теги Git `v*` публикуются как одноимённые теги образа. Pull request проверяет сборку без публикации; также доступен ручной запуск workflow.

Публикация использует встроенный `GITHUB_TOKEN` с правом `packages: write`. Дополнительный токен не нужен. Настройка соответствует [документации Docker для GitHub Actions](https://docs.docker.com/build/ci/github-actions/push-multi-registries/).

```sh
# Локальная сборка
docker build -t x3-bot-app .

# Запуск опубликованного образа
docker run -d --name x3-bot-app --restart unless-stopped \
   --env-file .env -e NODE_ENV=production \
   -e APPROVALS_FILE=/app/data/approvals.json \
   -p 127.0.0.1:8081:8081 \
   -v x3-bot-app-data:/app/data \
   ghcr.io/merzzzl/x3-bot-app:latest
```

В `.env` установите `PORT=8081`, публичный HTTPS-адрес в `APP_ORIGIN` и параметры доверенного reverse proxy. HTTPS-прокси должен направлять запросы на порт 8081. Образ работает от пользователя `node`; именованный volume сохраняет заявки между пересозданиями контейнера. Не запускайте контейнер одновременно с локальным экземпляром того же бота.

`.env` и локальные заявки не включаются в контекст Docker-сборки. Для приватного GHCR-пакета перед `docker pull` / `docker run` потребуется `docker login ghcr.io` с правом чтения пакетов.
