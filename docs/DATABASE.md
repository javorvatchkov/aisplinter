# AISplinter — Postgres database setup

AISplinter requires **PostgreSQL** for entitlements and the usage ledger. Your **application database can stay anything** (Mongo, Redis, etc.) — AISplinter only needs its own Postgres connection.

All AISplinter tables are named **`aisplinter_*`** so they never collide with app tables like `users`.

---

## Three hosting patterns

| Pattern | When to use | Config |
|---------|-------------|--------|
| **1. Separate database** | Default / recommended | `DATABASE_URL=postgresql://…/aisplinter` (database name `aisplinter` on same server as your app) |
| **2. Separate schema** | Same Postgres database as your app | `DATABASE_URL=postgresql://…/myapp` + `AISPLINTER_DB_SCHEMA=aisplinter` |
| **3. Same schema (`public`)** | Quick embed on shared DB | `DATABASE_URL` only — tables are `aisplinter_projects`, `aisplinter_users`, … |

### Tables created

- `aisplinter_projects`
- `aisplinter_users`
- `aisplinter_entitlements`
- `aisplinter_usage_ledger`
- `aisplinter_webhook_deliveries`

Legacy installs (unprefixed `users`, `projects`, …) are **renamed automatically** on next boot migration.

---

## Environment variables

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/aisplinter?sslmode=require` |
| `AISPLINTER_DB_SCHEMA` | No | `aisplinter` — Postgres schema (not database name) |

---

## Setup surfaces (same flow, pick one)

### A. Web wizard

Standalone: **http://127.0.0.1:8747/**  
Embedded: **http://localhost:3000/api/aisplinter/** (when `setupWizard: true`)

Steps: Postgres URL → optional schema → upstream provider → dev key.

### B. Console CLI

```bash
cd aisplinter-code/packages/server
pnpm build

# Interactive
pnpm setup database --interactive
# or after global/link install:
npx aisplinter-setup database --url "$DATABASE_URL" --schema aisplinter

# Check state
npx aisplinter-setup status

# Create project (upstream step)
npx aisplinter-setup init --name MyApp --adapter openrouter --openrouter-key "$AISPLINTER_OPENROUTER_KEY"
```

### C. VS Code (optional)

See `docs/VSCODE_SETUP.md` — run the CLI via a task or a thin extension wrapper.

### D. `.env` only (no UI)

Copy `packages/server/.env.example` — complete `DATABASE_URL` + upstream vars. Restart server; auto-bootstrap on first request.

---

## Neon OAuth (Model A — user's Neon account)

Lets integrators click **Connect Neon** in the wizard without pasting URLs. The database is created in **their** Neon account (free tier), not yours.

### Server env (operator / self-host)

```bash
NEON_OAUTH_CLIENT_ID=…
NEON_OAUTH_CLIENT_SECRET=…
# optional
NEON_DEFAULT_REGION_ID=aws-us-east-1
```

Register an OAuth app in the [Neon console](https://console.neon.tech) and set redirect URI:

- Standalone: `http://127.0.0.1:8747/setup/neon/callback`
- Embedded at `/api/aisplinter`: `http://localhost:3000/api/aisplinter/setup/neon/callback`

Docs: [Neon OAuth integration](https://neon.tech/docs/guides/oauth-integration)

### Flow

1. User clicks **Connect Neon** → Neon login/consent  
2. AISplinter creates a Neon project + `aisplinter` database  
3. Connection string saved → migrations run → wizard continues  

---

## Instructions for builder AI / integrators

When embedding AISplinter in an existing Postgres app:

1. **Prefer** a dedicated database: append `/aisplinter` to the connection host URL or create DB `CREATE DATABASE aisplinter;`.
2. If you must share one database, set `AISPLINTER_DB_SCHEMA=aisplinter` — do not merge AISplinter rows into app tables.
3. Never rename AISplinter tables; use `external_user_id` to link to your app's user id.
4. Run setup via wizard, CLI, or env — all three call the same `connectAisplinterDatabase()` path.
5. Egocentric reference: same Neon instance, AISplinter tables co-located with web app schema (embed pattern in `apps/web`).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `relation "users" already exists` | Upgrade to prefixed tables or set `AISPLINTER_DB_SCHEMA` |
| Neon SSL errors | Use `?sslmode=require` in URL |
| Wizard can't save URL in production embed | Set `DATABASE_URL` in host `.env` (wizard persistence is dev-only when env unset) |
| `Neon OAuth is not configured` | Add `NEON_OAUTH_*` or paste `DATABASE_URL` manually |
