# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Next.js 16 / React 19 here have breaking changes versus older versions — check `node_modules/next/dist/docs/` before using Next.js APIs (see AGENTS.md).

## Commands

```bash
npm run dev                      # next dev, proxies /api to BACKEND_URL (.env) or https://pptx-check-back.relaxdev.ru
npm run build                    # server build; static export only when nginx.conf.generated.template exists (see Deploy)
npm run lint                     # eslint
npm run test:e2e                 # Playwright, starts `npm run dev` itself (reuses a running one)
npx playwright test -g "new check clears the report"     # single test by name
npx playwright test --project=desktop-chrome             # single device project (also: ipad, iphone, pixel)
```

E2E tests mock the backend with `page.route("**/api/check*")` — no backend is needed. Shared mocks and helpers (fixture reports, `openApp`, `dropPptx`, `readDb` for reading IndexedDB) live in `e2e/fixtures.ts`. Components expose `data-testid` attributes that the tests depend on.

## Architecture

Single-page client UI for checking `.pptx` files. All logic lives in the browser; the Python backend (separate repo, `pptx-check-back`) does the analysis.

- `app/page.tsx` renders `components/checker-app.tsx` (a `"use client"` component), which owns all state: locale, available checks, enabled switches, in-flight flag, report.
- `lib/api.ts` — the only backend calls: `GET /api/checks` (check definitions) and `POST /api/check` (multipart `file` + `enabled_checks` JSON array). Always relative URLs (`API_BASE = ""`). Errors map to `ApiErrorCode` from the `{error: {code}}` body, falling back to HTTP 429 → `RATE_LIMITED`, 504 → `TIMEOUT`. Client-side validation: `.pptx` only, max 5 MB.
- `lib/types.ts` mirrors the backend JSON contract (snake_case fields). Slide geometry is in EMU; `slide-card.tsx` draws a schematic SVG with `viewBox` = slide EMU size and marks elements referenced by `issue.element_id`.
- `lib/db.ts` — IndexedDB `pptx-checker` (via `idb`) with stores `settings` (locale, enabledChecks), `history` (capped at 200) and `event_log` (capped at 1000). Persistence is best-effort: every function swallows errors, and the app must keep working without IndexedDB.
- `lib/i18n.ts` — i18next with `locales/ru.json` and `locales/en.json`; default is `ru`, browser language picks `en`. Every UI string goes through `t()` and must be added to both locale files.
- UI uses shadcn/ui (`components/ui/`, config in `components.json`, base-ui primitives), Tailwind CSS v4 via `@tailwindcss/turbopack`, and `next-themes` for theming.

Because production is a static export (`output: "export"`), no server-side Next.js features may be used: no route handlers, middleware, server actions or dynamic rendering.

## Deploy (RelaxDev)

Full guide: `RELAXDEV-DEPLOY-GUIDE.md`; project specifics: `RELAXDEV.md`.

- Docker build: `scripts/bake-rewrites.mjs` reads the backend URL from `rewrites.json` and writes `nginx.conf.generated.template` from `nginx.conf.template`; then `next build` produces `out/`, served by nginx, which proxies `/api/*` to the backend.
- `next.config.ts` switches to `output: "export"` **by checking whether `nginx.conf.generated.template` exists**, not via an env var. RelaxDev replaces any `process.env.X` that isn't set in the project with the string `auto-generated-stub-for-build`, so build flags and defaults must not depend on env vars. If an env var is needed, read it as `process.env["X"]` (RelaxDev doesn't stub that form).
- The backend URL lives only in `rewrites.json`; no API env vars are set in the RelaxDev panel. After changing `rewrites.json` or `nginx.conf.template`, redeploy without the Docker cache.
- Delete `nginx.conf.generated.template` after a local build check, otherwise `next dev`/`next build` will also run in static mode.
- RelaxDev's human-readable error hints can be wrong (e.g. "no package.json in root"); read the raw Docker log for the failing step.
