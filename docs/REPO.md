# Repository layout

AISplinter is a **standalone repo**. Egocentric lives in a sibling folder:

```text
egocentric/
  aisplinter/          ← this repo
  egocentric-code/     ← consumes @aisplinter/server via file: or npm
```

Egocentric integration: see `egocentric-code/docs/AISPLINTER_PLAN.md`.

## Quick start

```bash
pnpm install
cd apps/server && cp ../../packages/server/.env.example .env
pnpm dev
```

Or from Egocentric root: `npm run dev:aisplinter` (requires both repos cloned side by side).
