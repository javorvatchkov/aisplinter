# AISplinter — developer setup

AISplinter sits between **your app** and **LLM providers**. You run one AISplinter deployment per product; it provisions scoped keys per user, enforces budgets, and proxies chat when you want server-side metering.

This guide reflects what we learned integrating AISplinter into Egocentric (Next.js embed + Tauri desktop + mobile). Use it for any host app.

---

## Two layers of configuration

| Layer | Who reads it | Where | Purpose |
|-------|--------------|-------|---------|
| **Server** | AISplinter process (`@aisplinter/server`) | Host app `.env` (e.g. `apps/web/.env` or `apps/server/.env`) | Postgres, upstream provider, dev key, JWT |
| **Client** | Your app backend or desktop shell | App `.env` (never commit secrets to the browser) | Base URL + dev key **or** end-user session token |

**Rule:** `DATABASE_URL`, OpenRouter/LiteLLM keys, and `JWT_SECRET` stay on the server. Client code only needs `AISPLINTER_BASE_URL` + `AISPLINTER_DEV_KEY` (for provisioning) or `AISPLINTER_SESSION_TOKEN` (after provision).

---

## Server environment variables

Copy `packages/server/.env.example` → your host `.env`.

### Required

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://…@ep-xxx.neon.tech/neondb?sslmode=require` | Postgres only. See **`docs/DATABASE.md`** for separate DB vs schema vs shared `public`. |
| `AISPLINTER_DB_SCHEMA` | `aisplinter` | Optional Postgres schema when sharing one database with your app. Tables are always `aisplinter_*`. |
| `AISPLINTER_UPSTREAM_ADAPTER` | `openrouter` | `openrouter` or `litellm` |
| `AISPLINTER_OPENROUTER_KEY` | `sk-or-v1-…` | **Management / provisioning key**, not a plain inference key. Create at [openrouter.ai/keys](https://openrouter.ai/keys). Validated via `/api/v1/credits`. |

### Project

| Variable | Example | Notes |
|----------|---------|-------|
| `AISPLINTER_PROJECT_NAME` | `MyApp` | Display name in admin |
| `AISPLINTER_DEV_KEY` | `aisplinter_dev_…` | Optional but **recommended**. Pin so restarts/DB resets keep the same dev key. If omitted, one is generated on first boot (printed to console). |

### Standalone runner only (`apps/server`)

| Variable | Example | Notes |
|----------|---------|-------|
| `PORT` | `8747` | Default dev port |
| `JWT_SECRET` | 32+ random chars | Signs end-user session JWTs (`aisplinter_sess_…`, ~1h TTL) |

### Optional

| Variable | Notes |
|----------|-------|
| `AISPLINTER_ADMIN_SECRET` | Protects `/admin` off localhost |
| `AISPLINTER_LITELLM_BASE_URL` / `AISPLINTER_LITELLM_KEY` | When adapter is `litellm` |
| `AISPLINTER_DATA_DIR` | Wizard-only fallback if `DATABASE_URL` is not in `.env` |
| `NEON_OAUTH_CLIENT_ID` / `NEON_OAUTH_CLIENT_SECRET` | Enables **Connect Neon** in setup wizard (user's Neon account) |
| `OPENROUTER_API_KEY`, `LITELLM_*` | Aliases for the `AISPLINTER_*` vars above |

### Bootstrap behaviour

When the DB has **no project** yet and env is complete, AISplinter **auto-bootstraps** on first request — no wizard UI required. Check:

```bash
curl -s http://127.0.0.1:8747/health | jq
# or, when embedded: curl -s http://localhost:3000/api/aisplinter/health | jq
```

---

## Client environment variables

Copy `packages/core/.env.example` into your integrator app.

| Variable | Example | Notes |
|----------|---------|-------|
| `AISPLINTER_BASE_URL` | `http://127.0.0.1:8747` | Standalone |
| | `http://localhost:3000/api/aisplinter` | Next.js embed at `/api/aisplinter` |
| `AISPLINTER_DEV_KEY` | `aisplinter_dev_…` | Server-side only — used to call `POST /v1/users/provision` |
| `AISPLINTER_SESSION_TOKEN` | `aisplinter_sess_…` | After provision; use for proxy chat |
| `AISPLINTER_PLAN_SKU` | `ai_starter` | Default plan when auto-provisioning (optional) |

Use `@aisplinter/core` helpers:

```typescript
import { loadConfigFromEnv, AISPLINTER_ENV } from '@aisplinter/core';

const config = loadConfigFromEnv(process.env);
// null if neither DEV_KEY nor SESSION_TOKEN is set
```

---

## Quick start paths

### A. Standalone dev server (fastest)

```bash
cd aisplinter-code/apps/server
cp ../../packages/server/.env.example .env
# Edit DATABASE_URL, AISPLINTER_OPENROUTER_KEY, optional AISPLINTER_DEV_KEY
pnpm install && pnpm dev
```

Open **http://127.0.0.1:8747** — setup wizard if env is incomplete, otherwise **/admin**.

**Or use the CLI** (same database step as the wizard):

```bash
cd aisplinter-code/packages/server && pnpm build
npx aisplinter-setup database --interactive
npx aisplinter-setup init --name MyApp --adapter openrouter --openrouter-key "$AISPLINTER_OPENROUTER_KEY"
```

See **`docs/DATABASE.md`** for separate database vs schema vs Neon OAuth.

From Egocentric monorepo root: `npm run dev:aisplinter`

### B. Embed in Next.js

See `apps/demo-next` and Egocentric `apps/web`:

1. Add `@aisplinter/server` to the host app workspace.
2. Create `lib/aisplinter-server.ts`:

```typescript
import { createAisplinterApp } from '@aisplinter/server';
import { createAisplinterSingleton } from '@aisplinter/server/next';

export const AISPLINTER_BASE_PATH = '/api/aisplinter';

export const getAisplinterApp = createAisplinterSingleton(async () => {
  const { app } = await createAisplinterApp({
    basePath: AISPLINTER_BASE_PATH,
    setupWizard: process.env.NODE_ENV !== 'production',
    logger: process.env.NODE_ENV !== 'production',
  });
  return app;
});
```

3. Add catch-all route `app/api/aisplinter/[...path]/route.ts` with `createNextRouteHandlers(getAisplinterApp)`.
4. Put server vars in host `.env` (reuse `DATABASE_URL` if you already use Neon).
5. Dev setup UI: **http://localhost:3000/api/aisplinter/** (wizard) or **/admin**.

Build from Egocentric root when using the linked workspace package:

```bash
npm run build:aisplinter-server
```

---

## Core integration flows

### 1. Provision a user (server-side)

Your backend calls AISplinter with the **dev key**:

```http
POST /v1/users/provision
Authorization: Bearer aisplinter_dev_…
Content-Type: application/json

{
  "external_user_id": "user_abc123",
  "plan_sku": "ai_starter",
  "renew": false
}
```

Response includes `session_token`, `provider_api_key`, `aisplinter_user_id`, and entitlement budget.

**Plan SKUs** (default catalog): `ai_trial`, `ai_starter`, `ai_pro`, `ai_power`. Your product may map friendly names (e.g. `starter` → `ai_starter`) in its own layer.

### 2. Chat via proxy (session token)

```http
POST /v1/chat/completions
Authorization: Bearer aisplinter_sess_…
```

Uses reserve → stream → reconcile ledger flow for budget enforcement.

### 3. Client-direct inference (optional)

Egocentric Basic AI uses provision to obtain a **scoped OpenRouter key** (`provider_api_key`) and calls OpenRouter directly from the device — no per-token traffic through your web server. AISplinter is still the provisioning layer; enforcement is OpenRouter key limits.

Choose proxy vs client-direct based on whether you need central ledgering vs minimal hosting cost.

### 4. In-process provision (embedded Next.js)

When AISplinter runs in the same Node process, prefer `app.fetch()` over HTTP loopback to your public URL (avoids Railway/ngrok issues):

```typescript
const app = await getAisplinterApp();
const res = await app.fetch(
  new Request(`http://127.0.0.1${AISPLINTER_BASE_PATH}/v1/users/provision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${devKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ external_user_id: userId, plan_sku: 'ai_starter' }),
  }),
);
```

---

## Onboarding UI (setup wizard)

When `setupWizard: true` and the DB has no project:

| URL | Purpose |
|-----|---------|
| `/` or `/api/aisplinter/` | Multi-step wizard |
| `/setup/status` | JSON — `canBootstrapFromEnv`, `databaseReady`, etc. |
| `/setup/plans` | Default plan catalog for the verify step |
| `/admin` | Developer console after setup |

Wizard stages: **Welcome** → **Database** (if needed) → **Upstream config** → **Dev key** → **Connect your app** → **Verify provision**.

---

## Egocentric reference wiring (optional read)

Egocentric is one integrator; patterns are reusable:

| Piece | Location |
|-------|----------|
| Next embed + env bootstrap | `apps/web/lib/server/aisplinter-server.ts` |
| User provision API | `apps/web/lib/server/aisplinter-provision.ts` |
| Desktop connect (no dev key in UI) | `apps/web/app/api/auth/desktop-aisplinter-connect` |
| Tauri agent + env auto-connect | `apps/desktop/src-tauri/src/agent.rs` |
| Desktop `.env` override | `apps/desktop/src-tauri/.env.example` |
| UI onboarding | `apps/desktop/src/OnboardingAisplinterSection.svelte` |

**Egocentric web `.env`:** reuses `DATABASE_URL`; adds `AISPLINTER_OPENROUTER_KEY`, `AISPLINTER_DEV_KEY`, `AISPLINTER_PROJECT_NAME`.

**Egocentric desktop `.env` (local dev only):** optional `AISPLINTER_DEV_KEY`, `AISPLINTER_BASE_URL`, `AISPLINTER_PLAN_SKU` for silent auto-connect without the web route.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Invalid OpenRouter key | Use a **management** key from openrouter.ai/keys, not inference-only |
| Setup wizard every restart | Set full server env; ensure project row exists or bootstrap succeeds |
| Dev key changes after DB reset | Set `AISPLINTER_DEV_KEY` in `.env` |
| Provision 401 | Wrong or missing `AISPLINTER_DEV_KEY` in `Authorization: Bearer` |
| `/admin` asks for secret | Set `AISPLINTER_ADMIN_SECRET` or use localhost |
| Embedded 404 | Check `basePath` matches route (`/api/aisplinter`) and rebuild `@aisplinter/server` |

---

## Next steps

- UI components: `@aisplinter/react`, `@aisplinter/svelte` — see `apps/demo-next`
- OpenAPI: `packages/server/openapi.yaml`
- Docker: `docker-compose.yml` at repo root
