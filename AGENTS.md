# Instructions for AI Agents

You are helping build **AISplinter**, a neutral AI infrastructure layer. Follow these rules strictly:

## 1. Architectural Principles
- **Postgres only:** Use Postgres for AISplinter state (entitlements + ledger). Optional `AISPLINTER_DB_SCHEMA`; tables are always prefixed `aisplinter_*`. See `docs/DATABASE.md`.
- **Hono (TypeScript):** The server uses Hono for high-performance API proxying.
- **Embeddable first:** Core server logic lives in `@aisplinter/server` (`packages/server`). Any host can mount it via `createAisplinterApp()`. The standalone runner (`apps/server`) is optional dev scaffolding.
- **Stateless JWT:** End-user session tokens (`aisplinter_sess_...`) must be stateless JWTs with a short TTL (1 hour).
- **Single project per install:** One AISplinter deployment per codebase. Tables still use `project_id` as the FK scope for users and ledger rows.
- **Neutrality:** AISplinter must remain a neutral layer. Do not add features that favor one specific application (like Egocentric).

## 2. Core Flows
- **Reserve → Stream → Reconcile:** When proxying chat completions, always use the three-step ledger flow to prevent budget overshoot.
- **Setup Wizard:** The server should start in "Setup Mode" if no configuration is found in the database.

## 3. Directory Map
- `packages/server` (`@aisplinter/server`): Mountable Hono app — routes, DB, adapters, setup wizard.
- `apps/server` (`@aisplinter/server-standalone`): Thin Node entry on port 8747 for local dev / Docker.
- `packages/core`, `packages/react`, `packages/svelte`: MIT-licensed SDKs and UI components.
- `apps/demo-next`: Next.js embed example (`/api/aisplinter/[...path]`).
- `infra/`: Configuration for Caddy, Docker, and LiteLLM.

## 4. Coding Style
- Use **Drizzle ORM** for database interactions.
- Ensure all API routes are documented in the `openapi.yaml`.
- Prefer thin, testable modules.
