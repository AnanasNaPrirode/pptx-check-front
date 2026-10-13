# RelaxDev: деплой статического Next.js с прокси `/api` на бэкенд

Инструкция по настройке фронтенда на Next.js (App Router) для https://relaxdev.ru/: сборка в статику (`output: "export"`), раздача через nginx в Docker, запросы `/api/*` проксируются на отдельный бэкенд. Все нужные файлы приведены ниже целиком, их можно скопировать в новый проект как есть.

## Схема

```
Браузер ──► https://<front>.relaxdev.ru
              nginx (контейнер фронта)
              ├── /api/*  ──► https://<back>.relaxdev.ru/api/*
              └── /*      ──► статика из out/ (index.html как fallback)
```

- Клиентский код ходит на относительный `/api/...` того же домена. Абсолютный адрес бэкенда в JS не попадает, CORS не нужен.
- Адрес бэкенда хранится в `rewrites.json` и при сборке образа вшивается в конфиг nginx.
- Переменные окружения для API в панели RelaxDev **не задаются**.

## Особенности RelaxDev, из-за которых падают сборки

Платформа вмешивается в сборку даже с собственным Dockerfile. Это видно в логе:

| Что делает RelaxDev | Последствие |
|---|---|
| Ищет в коде обращения `process.env.X` и, если переменной `X` нет в настройках проекта, подставляет строку `auto-generated-stub-for-build` и при сборке, и в рантайме | Любой флаг вида `process.env.FLAG === "1"` становится ложным, а `process.env.X \|\| "дефолт"` никогда не берёт дефолт. `ENV FLAG=1` в Dockerfile это не спасает |
| Переписывает шаг сборки в `RUN NODE_ENV=production npm run build` и добавляет свои шаги (`npm install react react-dom --legacy-peer-deps`, `.missing_deps_fix.cjs`) | Номера шагов в логе не совпадают с вашим Dockerfile, это нормально |
| Патчит `.env`, `.env.local`, `.env.production`, `.env.production.local` | Не полагайтесь на значения из этих файлов при сборке |
| Убирает из скрипта `build` команды `prisma migrate deploy` и `prisma db push` | Миграции в `build` не выполнятся |
| Показывает «человеческую» подсказку к ошибке (например, «В корне проекта нет package.json») | Подсказка может не иметь отношения к реальной ошибке. **Всегда смотрите сырой лог Docker**: строку `ERROR:` и шаг, на котором упало |

Отсюда главное правило: **режим сборки и адрес бэкенда не должны зависеть от переменных окружения.** Статический режим включается по наличию файла, который создаётся только внутри Docker-сборки. Адрес бэкенда берётся из закоммиченного `rewrites.json`.

Если обращение к переменной всё же нужно (например, для локальной разработки), читайте её через квадратные скобки: `process.env["BACKEND_URL"]`. Такие обращения RelaxDev не подменяет. Для `NEXT_PUBLIC_*` этот приём не работает.

## Файлы проекта

Все файлы лежат в корне репозитория рядом с `package.json`.

### `rewrites.json`

Единственное место, где задаётся адрес бэкенда. `destination` — полный URL без завершающего `/` и без `/api`.

```json
{
  "rewrites": [
    {
      "source": "/api/*",
      "destination": "https://pptx-check-back.relaxdev.ru"
    }
  ]
}
```

### `nginx.conf.template`

`__BACKEND_URL__` заменяет скрипт при сборке образа. `${PORT}` подставляет сам образ nginx при старте контейнера (envsubst). Лимит тела и таймауты подберите под свой бэкенд: таймаут nginx должен быть больше таймаута бэкенда.

```nginx
server {
    listen       ${PORT};
    server_name  _;
    root         /usr/share/nginx/html;
    index        index.html;

    client_max_body_size 6m;

    location /api/ {
        proxy_pass         __BACKEND_URL__;
        proxy_http_version 1.1;
        proxy_set_header   Host              $proxy_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`proxy_pass` указан без пути, поэтому запрос `/api/checks` уходит на `<backend>/api/checks` без изменений. `Host $proxy_host` обязателен: бэкенд на RelaxDev маршрутизируется по имени хоста.

### `scripts/bake-rewrites.mjs`

Читает `rewrites.json`, проверяет его и пишет `nginx.conf.generated.template`. Этот же файл служит признаком Docker-сборки для `next.config.ts`.

```js
/**
 * Читает rewrites.json и собирает nginx-конфиг с зашитым destination.
 * Меняйте только rewrites.json — env для API не нужны.
 */
import { readFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(readFileSync("rewrites.json", "utf8"));
const apiRewrite = config.rewrites?.find(
  (r) => typeof r.source === "string" && r.source.includes("/api"),
);

if (!apiRewrite?.destination) {
  throw new Error(
    'rewrites.json: нужен rewrite вида { "source": "/api/(.*)", "destination": "https://..." }',
  );
}

const backend = String(apiRewrite.destination).replace(/\/$/, "");
if (!/^https?:\/\//i.test(backend)) {
  throw new Error(`rewrites.json: destination должен быть полным URL, сейчас: ${backend}`);
}

const template = readFileSync("nginx.conf.template", "utf8");
if (!template.includes("__BACKEND_URL__")) {
  throw new Error("nginx.conf.template: нет плейсхолдера __BACKEND_URL__");
}

writeFileSync(
  "nginx.conf.generated.template",
  template.replaceAll("__BACKEND_URL__", backend),
);

console.log(`nginx: /api/* → ${backend}/api/*`);
```

### `next.config.ts`

Статический экспорт включается, если существует `nginx.conf.generated.template`. Файл есть только внутри Docker-сборки: он в `.gitignore` и `.dockerignore`, а создаёт его шаг Dockerfile перед `npm run build`. В остальных случаях (`next dev`) Next.js сам проксирует `/api`.

```ts
import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Docker build runs scripts/bake-rewrites.mjs first, which writes this file.
// RelaxDev replaces unknown env vars with stubs, so the flag cannot be an env var.
const staticExport = existsSync("nginx.conf.generated.template");
const backendUrl = (
  process.env["BACKEND_URL"] ?? "https://pptx-check-back.relaxdev.ru"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Docker builds a static export and proxies /api in nginx.
  // The Next.js server (local dev) proxies /api itself.
  ...(staticExport
    ? { output: "export" as const }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${backendUrl}/api/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
```

Остальные настройки проекта (например, `turbopack`) добавляются в этот же объект.

С `output: "export"` недоступны серверные возможности Next.js: route handlers (`app/api/...`), middleware, `rewrites()`, динамический рендеринг. Все запросы к API должны выполняться из браузера.

### `Dockerfile`

Двухэтапная сборка: Node собирает статику в `out/`, nginx её раздаёт.

```dockerfile
# RelaxDev: Next.js static export + nginx, rewrite /api/* из rewrites.json
# https://relaxdev.ru/deploy/docker

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Creates nginx.conf.generated.template; next.config.ts switches to output: 'export' when it exists
RUN node scripts/bake-rewrites.mjs
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/nginx.conf.generated.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/out /usr/share/nginx/html

ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT

EXPOSE 8080
```

- `PORT` выставляет платформа, `8080` — запасное значение.
- `NGINX_ENVSUBST_FILTER=PORT` нужен, чтобы envsubst не затёр nginx-переменные `$proxy_host`, `$remote_addr` и другие.
- Шаблон кладётся в `/etc/nginx/templates/`: образ nginx сам прогоняет его через envsubst при старте.

### `.dockerignore`

```
node_modules
out
.next
.git
.env
.env.*
!.env.example
nginx.conf.generated.template
```

`package.json`, `package-lock.json`, `rewrites.json`, `nginx.conf.template` и `scripts/` исключать нельзя.

### `.gitignore` (дополнительные строки)

```
/node_modules
/.next/
/out/
.env*
!.env.example
nginx.conf.generated.template
```

`nginx.conf.generated.template` не должен попадать ни в git, ни в Docker-контекст. Иначе `next dev` локально включит статический режим, а в образ может попасть устаревший адрес бэкенда.

### Клиентский код

Запросы к API — только по относительному пути:

```ts
const response = await fetch("/api/checks");
```

### Локальная разработка (необязательно)

`.env` для `next dev` (в git не коммитится, на RelaxDev не задаётся):

```
BACKEND_URL=http://127.0.0.1:8000
```

Без этой переменной `next dev` проксирует `/api` на адрес по умолчанию из `next.config.ts`.

## Настройки в панели RelaxDev

1. **Источник деплоя:** репозиторий фронтенда на GitHub.
2. **Ветка сборки:** `main` (или ваша рабочая).
3. **Стек сборки:** Docker (собственный Dockerfile), не автодетект Node.
4. **Корневая папка:** корень репозитория (пусто или `/`), если `package.json` лежит в корне.
5. **Переменные:** для API ничего не добавлять. Не добавляйте и флаги сборки: режим определяется без них.
6. **Порядок:** сначала деплоится бэкенд, затем фронт. На бэкенде в `FRONTEND_URL` (или аналогичной переменной для CORS и ссылок) указывается адрес фронта.
7. После изменения `rewrites.json` или `nginx.conf.template` деплоить **без кэша Docker**: адрес вшивается в образ на этапе сборки.

Бэкенд должен быть доступен с серверов RelaxDev (они в Москве).

## Проверка перед пушем

Повторите шаги Dockerfile локально:

```bash
rm -rf out
node scripts/bake-rewrites.mjs     # выводит: nginx: /api/* → https://.../api/*
npx next build                     # в конце: "○ (Static) prerendered as static content"
ls out                             # должны быть index.html и _next/
rm nginx.conf.generated.template   # иначе next dev тоже включит статический режим
```

Если установлен Docker:

```bash
docker build --no-cache -t front-test .
docker run --rm -p 8080:8080 front-test
# http://localhost:8080 — страница; http://localhost:8080/api/... — ответ бэкенда
```

## Чтение лога сборки

В успешном логе по порядку идут:

1. `COPY package.json package-lock.json ./` и `RUN npm ci` — `added N packages`.
2. `RUN node scripts/bake-rewrites.mjs` — `nginx: /api/* → https://.../api/*`.
3. `npm run build` — таблица маршрутов с `○ (Static)`.
4. `COPY --from=build /app/out /usr/share/nginx/html` — без ошибок.

В блоке «Переменные из кода, которых нет в настройках проекта» не должно быть флагов, от которых зависит сборка.

## Типичные ошибки

| Ошибка в логе | Причина | Что сделать |
|---|---|---|
| `"/app/out": not found` на шаге `COPY --from=build /app/out` | Next.js собрался не в режиме `export`. Чаще всего режим зависел от env-переменной, а RelaxDev подставил заглушку | Включать `output: "export"` по наличию файла, как в `next.config.ts` выше |
| Подсказка «В корне проекта нет package.json», хотя файл на месте | Подсказка RelaxDev не соответствует реальной ошибке | Найти в сыром логе строку `ERROR:` и шаг Docker, на котором упало |
| `rewrites.json: нужен rewrite вида ...` или `destination должен быть полным URL` | Неверный `rewrites.json` | Указать `source: "/api/*"` и полный `https://` URL без завершающего `/` |
| `"/app/nginx.conf.generated.template": not found` | Шаг `bake-rewrites.mjs` не выполнился или удалён из Dockerfile | Вернуть `RUN node scripts/bake-rewrites.mjs` перед `npm run build` |
| `npm ci` — `package.json and package-lock.json are not in sync` | Lock-файл не обновлён после изменения зависимостей | Выполнить `npm install` локально и закоммитить `package-lock.json` |
| `Page "/..." is missing "generateStaticParams()"` или ошибка про route handlers при export | Используются серверные возможности, несовместимые со статическим экспортом | Перенести логику на бэкенд, динамические маршруты описать через `generateStaticParams` |
| Сайт открывается, а `/api/*` отвечает 502/504 | Бэкенд недоступен или отвечает дольше `proxy_read_timeout` | Проверить бэкенд напрямую, увеличить таймауты в `nginx.conf.template` и задеплоить без кэша |
| После смены адреса бэкенда запросы идут на старый | Образ собран из кэша | Деплой без кэша Docker |
