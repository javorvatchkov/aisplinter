# AISplinter

**Repository:** https://github.com/javorvatchkov/aisplinter

**AISplinter** is open-source middleware between your application and LLM providers. It provisions scoped upstream keys, enforces budgets, proxies requests, and emits webhooks — so your users get AI under **your brand** without creating provider accounts.

## Core features

- **Single-project install** — one deployment per codebase; one dev key, one upstream config
- **Budget enforcement** — reserve → stream → reconcile ledger flow
- **Provider neutral** — OpenRouter (cloud) or LiteLLM (on-prem)
- **File-first setup** — complete `.env` bootstraps without UI; wizard for first-time devs
- **Embeddable** — mount in Next.js, Express, or any host that can call `app.fetch()`

## Tech stack

- **Server:** TypeScript (Hono) — `@aisplinter/server`
- **Database:** PostgreSQL
- **Monorepo:** PNPM workspaces + Turborepo

## Package layout

| Package | Role |
|---------|------|
| `@aisplinter/server` | Mountable Hono app — `createAisplinterApp()`, `startStandaloneServer()` |
| `@aisplinter/server-standalone` | Thin dev runner on `:8747` (`apps/server`) |
| `@aisplinter/core` | Client SDK + env helpers |
| `@aisplinter/react` / `@aisplinter/svelte` | UI components |

## Developer setup

**Egocentric integrators:** clone this repo next to `egocentric-code` — see [`docs/REPO.md`](./docs/REPO.md) and Egocentric [`docs/AISPLINTER.md`](../../egocentric-code/docs/AISPLINTER.md).

**AISplinter contributors:** start here:

**Start here:** [`docs/DEV_SETUP.md`](./docs/DEV_SETUP.md) — env vars, embed patterns, provision flow, troubleshooting.

### Config split

| Layer | File | Variables |
|-------|------|-----------|
| **Server** | host app `.env` | `DATABASE_URL`, `AISPLINTER_OPENROUTER_KEY`, `AISPLINTER_DEV_KEY`, … |
| **Client** | integrator `.env` | `AISPLINTER_BASE_URL`, `AISPLINTER_DEV_KEY` (or session token) |

Templates: `packages/server/.env.example` (server), `packages/core/.env.example` (client).

### Quick start — standalone

```bash
cd apps/server
cp ../../packages/server/.env.example .env
# Edit DATABASE_URL, AISPLINTER_OPENROUTER_KEY, optional AISPLINTER_DEV_KEY
pnpm install && pnpm dev
```

Open **http://127.0.0.1:8747** — setup wizard walks through DB → provider → dev key → connect app → verify provision.

### Quick start — Next.js embed

See `apps/demo-next` and [`docs/DEV_SETUP.md`](./docs/DEV_SETUP.md#b-embed-in-nextjs).

```typescript
import { createAisplinterApp } from '@aisplinter/server';
import { createAisplinterSingleton } from '@aisplinter/server/next';

export const getAisplinterApp = createAisplinterSingleton(async () => {
  const { app } = await createAisplinterApp({ basePath: '/api/aisplinter' });
  return app;
});
```

```typescript
// app/api/aisplinter/[...path]/route.ts
import { getAisplinterApp } from '@/lib/aisplinter-server';
import { createNextRouteHandlers } from '@aisplinter/server/next';

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } =
  createNextRouteHandlers(getAisplinterApp);
```

After setup: **`/admin`** (e.g. `http://localhost:3000/api/aisplinter/admin`) for dev key, users, upstream status.

### Onboarding wizard stages

When the database has no project yet:

1. **Welcome** — env-first path or wizard
2. **Database** — Neon / Postgres connection string (skipped if `DATABASE_URL` in env)
3. **Upstream** — OpenRouter management key or LiteLLM
4. **Dev key** — copy `AISPLINTER_DEV_KEY` to server `.env`
5. **Connect app** — server + client env blocks, Next.js snippet, curl
6. **Verify** — test `POST /v1/users/provision`

## License

- Client packages (SDK, React, Svelte): MIT
- `@aisplinter/server` and standalone runner: AGPL-3.0

## Website

Landing page with crystal-planet hero animation: [`website/`](./website/) — see [`website/README.md`](./website/README.md).
