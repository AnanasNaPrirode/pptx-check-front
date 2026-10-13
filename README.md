# Проверка презентаций

Одностраничный интерфейс: загрузка `.pptx`, отчёт по слайдам и замечаниям. Стек: Next.js (static export), shadcn/ui, Tailwind CSS.

```bash
npm install
npm run dev
```

`next dev` проксирует `/api` на `http://127.0.0.1:8000` (переменная `BACKEND_URL`). На RelaxDev адрес бэкенда задаётся в `rewrites.json`. Деплой: [RELAXDEV.md](RELAXDEV.md).

```bash
npm run test:e2e
```
