# RelaxDev: статический Next.js + прокси `/api/*` на бэкенд

Платформа: https://relaxdev.ru/

Браузер ходит на `/api/...` того же домена, nginx в контейнере проксирует эти запросы на бэкенд.

| Что | Пример |
|-----|--------|
| Фронт | `https://pptx-check-front.relaxdev.ru` |
| Бэкенд | `https://pptx-check-back.relaxdev.ru` |

Сначала деплоится бэкенд, затем фронт. После правки `rewrites.json` нужен деплой без кэша Docker: URL вшивается в образ.

## Почему не env

RelaxDev не читает `vercel.json`. Адрес бэкенда хранится в `rewrites.json` и при сборке образа вшивается в nginx. Клиент вызывает относительный `/api/...`, переменные API в панели не задавать. `PORT` выставляет платформа, запасной порт в образе — `8080`.

Бэкенд должен отвечать с хоста, доступного из Москвы.

## Файлы в корне

- `rewrites.json` — `source: "/api/*"`, `destination` — полный URL бэкенда без завершающего `/`.
- `scripts/bake-rewrites.mjs` — подставляет destination вместо `__BACKEND_URL__`.
- `nginx.conf.template` — `client_max_body_size 6m`, `proxy_read_timeout 180s` (таймаут бэкенда 170 с).
- `Dockerfile` — `npm run build` при `output: 'export'`, статика копируется из `/app/out`.
- `nginx.conf.generated.template` в `.gitignore`.

Локально `next dev` проксирует `/api` на `BACKEND_URL` из `.env` (`http://127.0.0.1:8000`). Без этой переменной и без Docker-сборки Next.js проксирует `/api/*` на `https://pptx-check-back.relaxdev.ru`.

## Панель

1. Репозиторий фронта, ветка `main`.
2. Настройки стека → **Свой Dockerfile** (не автодетект Node).
3. Переменные для API не добавлять.
4. Деплой. После правки `rewrites.json` — без кэша Docker.

На бэкенде `FRONTEND_URL` = адрес этого фронта.
