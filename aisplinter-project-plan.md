# AISplinter — Product & Engineering Plan

**Document purpose:** Single source of truth for building AISplinter as a **neutral, open-source, self-hosted** infrastructure layer. Written for engineers and AI agents implementing the project in a **new repository** (separate from Egocentric).

**Status:** Draft v1.2  
**Last updated:** 2026-06-22  
**License intent:** MIT (SDK/UI) + AGPL-3.0 (server) — confirm in repo before publish

---

## Table of contents

1. [Introduction & context](#1-introduction--context)
2. [Vision, principles, and non-goals](#2-vision-principles-and-non-goals)
3. [Stakeholders](#3-stakeholders)
4. [Problem statement](#4-problem-statement)
5. [Competitive landscape](#5-competitive-landscape)
6. [Product definition](#6-product-definition)
7. [Version 1 scope (self-hosted, free)](#7-version-1-scope-self-hosted-free)
8. [System architecture (V1)](#8-system-architecture-v1)
9. [Repository & package structure](#9-repository--package-structure)
10. [Core API specification (V1)](#10-core-api-specification-v1)
11. [Upstream adapters: OpenRouter + LiteLLM (V1)](#11-upstream-adapters-openrouter--litellm-v1)
12. [Entitlements & billing integration (V1)](#12-entitlements--billing-integration-v1)
13. [Webhooks (V1)](#13-webhooks-v1)
14. [Frontend SDK & UI (V1)](#14-frontend-sdk--ui-v1)
15. [Self-host deployment (V1)](#15-self-host-deployment-v1)
16. [Security & operations (V1)](#16-security--operations-v1)
17. [Reference integration: Egocentric](#17-reference-integration-egocentric)
18. [V1 milestones & acceptance criteria](#18-v1-milestones--acceptance-criteria)
19. [Version 2 preview (commercial services)](#19-version-2-preview-commercial-services)
20. [Monetization model (V2+)](#20-monetization-model-v2)
21. [Growth & community strategy](#21-growth--community-strategy)
22. [Open questions & decisions log](#22-open-questions--decisions-log)
23. [Glossary](#23-glossary)
24. [Strategic execution notes (critical paths)](#24-strategic-execution-notes-critical-paths)
25. [Money flow & payments (developer FAQ)](#25-money-flow--payments-developer-faq)

---

## 1. Introduction & context

### 1.1 Origin story

Egocentric (desktop productivity app) needs AI features (Egobot, email summarization, smart suggestions). The current UX forces users to:

- Create accounts on **OpenRouter**, **OpenAI**, or similar
- Paste **API keys** into settings
- Understand **models**, **tokens**, and **provider billing**

That is the wrong experience for **consumer and prosumer apps**. Users should see:

- A **simple list of plans/deals** inside the app they already use
- **One checkout** (developer’s Stripe)
- **No visibility** into OpenRouter, OpenAI, Anthropic, etc.

During planning, we explored:

| Approach | Verdict |
|----------|---------|
| Resell AI with commission | Viable business but Egocentric-specific; heavy MoR/compliance |
| OpenRouter OAuth / BYOK | Users still touch provider ecosystem |
| LLM Gateway / AI Pass embed | Dev tooling or consumer wallet — not neutral dev infrastructure |
| **AISplinter (this project)** | **Neutral OSS layer**: dev-branded, self-hosted, pluggable upstream |

**AISplinter** is the outcome: infrastructure **any developer** can install — Egocentric is **customer #1**, not a privileged owner.

### 1.2 One-line definition

> **AISplinter** is open-source middleware between your application and LLM providers. It provisions scoped upstream keys, enforces budgets, proxies requests, and emits webhooks — so your users get AI under **your brand** without ever creating provider accounts.

### 1.3 Stripe analogy (use in docs and marketing)

| Stripe | AISplinter |
|--------|-----------|
| Hides card networks and banks | Hides OpenRouter / OpenAI / Anthropic |
| Merchant keeps their brand | Developer keeps their brand |
| `sk_live_…` for server | `aisplinter_dev_…` for server |
| Webhooks on payment events | Webhooks on usage / budget / provision events |
| You bring your business logic | You bring Stripe; AISplinter maps pay → entitlement |

**Important difference:** AISplinter V1 does **not** process payments. Developers connect **their own Stripe** (or any billing) via documented webhooks. AISplinter stays neutral and free.

### 1.4 Business perspective (V1)

- **Product:** Developer infrastructure (B2B), not end-user wallet
- **Revenue in V1:** None from the core project — adoption and trust first
- **Cost to operator:** Self-hosters pay their own infra + upstream AI usage
- **Neutrality:** No Egocentric-only APIs, flags, or pricing tiers in core

### 1.5 End-user perspective

End users of apps using AISplinter should experience:

1. Open app → see **“Enable AI”** or **plan list** (Starter / Pro)
2. Pay **the app developer** (existing checkout)
3. Use AI immediately — **no API keys**, **no OpenRouter signup**
4. See usage/limit messages from **the app**, not from “AISplinter”

End users may never know AISplinter exists (and should not need to).

### 1.6 Developer perspective

Developers install AISplinter because they want to **ship AI monetization in days**, not build:

- Proxy server
- Per-user key minting
- Budget enforcement
- Stripe → entitlement mapping
- Empty states and connect UX

**Free (V1)** = OSS + Docker on their premises.  
**Paid (V2)** = optional hosted AISplinter, support, SLA — see [Section 19](#19-version-2-preview-commercial-services).

### 1.7 Future growth perspective

1. **Phase A (V1):** OSS self-host, **two upstream adapters** (OpenRouter + LiteLLM), Svelte + React UI, Egocentric reference
2. **Phase B (V2):** Hosted cloud, freemium tiers, optional Connect-style billing helper
3. **Phase C:** Additional adapters (direct OpenAI, Anthropic, Helicone), enterprise on-prem support
4. **Phase D:** Optional curated wholesale “deals catalog” for hosted customers only

Growth comes from **developer word of mouth** and **reference integrations**, not from end-user network effects (contrast: AI Pass).

---

## 2. Vision, principles, and non-goals

### 2.1 Vision

Become the **default self-hosted AI plumbing layer** for applications that sell AI to their own users — the way Postgres is default for data and Stripe is default for payments (without being the merchant).

### 2.2 Core principles

1. **Developer-first** — Primary user is the integrator, not the LLM end user
2. **Neutral** — No product (including Egocentric) gets special treatment in core
3. **Self-host by default** — V1 must run fully on-premises with no phone-home requirement
4. **Pluggable upstream** — **OpenRouter** (cloud aggregator) + **LiteLLM** (on-prem BYOK) in V1; adapter interface for more
5. **Transparent OSS** — Security-sensitive logic in open repo; auditable
6. **Separation of money and AISplinter** — V1 AISplinter does not hold funds; dev owns Stripe
7. **User never sees provider** — Keys and upstream accounts are implementation details

### 2.3 Non-goals (V1)

- [ ] Merchant of record / processing user payments
- [ ] Hosted multi-tenant SaaS (V2)
- [ ] Consumer wallet brand (“Sign in with AISplinter” for end users)
- [ ] Building a model router competitive with LiteLLM feature-for-feature
- [ ] Mobile SDKs (V1: HTTP API + web UI components only)
- [ ] Automatic creation of separate OpenRouter **user accounts** per end user (use **scoped keys** under dev’s upstream account instead)
- [ ] Egocentric-specific features in core repo

---

## 3. Stakeholders

| Stakeholder | Needs |
|-------------|-------|
| **Integrator dev** | Fast setup, docs, Docker, webhooks, UI components, predictable API |
| **App end user** | Simple enable/plan UX, no provider accounts |
| **AISplinter operator (self-host)** | Clear env config, health checks, upgrade path |
| **Upstream (OpenRouter / LiteLLM)** | Valid API usage via adapter-specific key provisioning |
| **Maintainers** | Sustainable OSS governance, V2 revenue without forked core |
| **Egocentric team** | Reference client; same APIs as everyone else |

---

## 4. Problem statement

### 4.1 Without AISplinter

Every app team rebuilds:

```
User enable AI
  → signup at provider OR paste BYOK key
  → app stores secrets (risk)
  → custom proxy
  → map user_id → usage
  → Stripe webhook → increment allowance
  → model string management
  → out-of-budget UX
  → rotate/revoke keys
```

AI coding tools generate a **demo** in hours; **production** takes weeks and ongoing maintenance.

### 4.2 With AISplinter (target state)

```
User enable AI in YOUR app
  → POST /v1/users/provision
  → AISplinter mints scoped upstream key + entitlement
  → all LLM traffic: app → AISplinter → OpenRouter **or** LiteLLM (dev chooses one)
  → Stripe (yours) → webhook handler template → AISplinter entitlement update
  → webhooks → your app for UX (banners, upsell)
```

---

## 5. Competitive landscape

| Product | Target | Overlap | Gap vs AISplinter |
|---------|--------|---------|------------------|
| OpenRouter | Devs / power users | Management API, routing | No full backend/UI/webhooks stack |
| LLM Gateway | Devs | Embed credits, OSS gateway | MoR/markup angle; not neutral self-host AISplinter |
| LiteLLM | Platform teams | Virtual keys, proxy | No dev product layer |
| SaaS LiteLLM | SaaS builders | Multi-tenant wrapper | Early, Python-only, no UI kit |
| AI Pass | Devs + end users | OAuth wallet | Consumer brand visible |
| Helicone / Synvolv | B2B SaaS ops | Metering, budgets | Dev still builds product UX |
| Stripe + DIY | Everyone | Payments | No AI layer |

**Whitespace:** Neutral, OSS, **on-prem**, **dev-branded**, **plan + entitlement + proxy + webhooks + UI** in one project.

---

## 6. Product definition

### 6.1 What AISplinter is

- HTTP API server (self-hosted)
- Upstream **adapter** layer (**OpenRouter** + **LiteLLM** in V1)
- **Tenant** model: each integrator = one `dev` (project)
- **End user** model: opaque id under a dev tenant
- **Entitlement** model: plan SKU → budget / model aliases
- **Proxy**: OpenAI-compatible chat completions (V1 minimum)
- **Webhook emitter** to developer’s backend
- **Client SDKs** + **UI components**
- **Docker Compose** for on-prem

### 6.2 What AISplinter is not

- Not a marketplace where end users buy AI from you
- Not a replacement for Stripe
- Not a hosted OpenRouter reseller (in V1)

### 6.3 Key technical clarification: “accounts” vs “keys”

OpenRouter [Management API](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) creates **API keys** under the **developer’s OpenRouter account**, with optional USD limits — not separate OpenRouter login per end user.

AISplinter language:

- ❌ “Creates OpenRouter account for user”
- ✅ “Provisions scoped upstream credential for user”

---

## 7. Version 1 scope (self-hosted, free)

### 7.1 V1 goals

1. A developer can `docker compose up` and integrate in **≤ 1 day**
2. End users enable AI **without** seeing OpenRouter, LiteLLM, or raw providers
3. Entitlements enforce **hard budget stop** (402)
4. Stripe template webhooks update entitlements
5. Svelte + React UI for connect/plan/usage states
6. Egocentric reference integration documented (external repo)

### 7.2 V1 feature list (IN)

| Area | Feature |
|------|---------|
| **Auth** | Dev API key (`aisplinter_dev_…`) for server; optional per-request user session token |
| **Tenants** | Single dev project per deployment (multi-dev in one DB ok; dashboard minimal) |
| **Users** | `external_user_id` → internal `aisplinter_user_id` |
| **Provision** | Mint upstream credential via **OpenRouter Management API** or **LiteLLM virtual keys** |
| **Upstream choice** | `AISPLINTER_UPSTREAM_ADAPTER=openrouter \| litellm` (one active per deployment) |
| **Plans** | YAML/DB-defined plan SKUs: `budget_usd`, `period`, `model_aliases` |
| **Proxy** | `POST /v1/chat/completions` OpenAI-compatible |
| **Enforcement** | Reject if no entitlement, expired, or budget exhausted |
| **Metering** | Log tokens + estimated USD per request |
| **Webhooks** | HMAC-signed outbound events to dev URL |
| **Billing bridge** | Inbound webhook route templates for Stripe (`checkout.session.completed`, `customer.subscription.*`) |
| **UI** | `@aisplinter/svelte`, `@aisplinter/react` — Connect, PlanList, UsageBanner, OutOfBudget |
| **Deploy** | Docker Compose: api + postgres + **optional LiteLLM stack** (profile `litellm`) + redis (optional) |
| **Docs** | Quickstart, API ref, Egocentric example, security notes |

### 7.3 V1 feature list (OUT / deferred)

- Hosted cloud offering
- MoR / aisplinter-processed payments
- Third adapter (direct OpenAI API, Helicone, etc.)
- Anthropic native API shape (V1 = OpenAI-compat only)
- Admin UI beyond basic health + Swagger
- SSO, audit export, SOC2
- Automatic model price optimization
- Mobile native SDKs

### 7.4 V1 success metrics

| Metric | Target |
|--------|--------|
| Time to first proxied chat | < 30 min following quickstart |
| Docker services start clean | 100% on Linux/macOS with documented env |
| Budget enforcement accuracy | 0 requests over hard cap in load test |
| Webhook delivery | Retry 3x with exponential backoff |
| Reference apps | ≥ 1 (Egocentric) + ≥ 1 minimal Next.js demo in repo |

---

## 8. System architecture (V1)

### 8.1 High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer's application                      │
│  (Egocentric, SaaS web app, etc.)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ @aisplinter/  │  │ Your Stripe  │  │ Your user database     │ │
│  │ ui + core    │  │ checkout     │  │ external_user_id       │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
└─────────┼─────────────────┼──────────────────────┼──────────────┘
          │                 │                      │
          │ chat            │ Stripe webhooks      │ provision
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              AISplinter (self-hosted on your premises)              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────┐  ┌────────────┐ │
│  │ API        │  │ Entitlement │  │ Metering │  │ Webhook    │ │
│  │ Proxy      │  │ Engine      │  │ Ledger   │  │ Dispatcher │ │
│  └─────┬──────┘  └─────────────┘  └──────────┘  └────────────┘ │
│        │                                                          │
│  ┌─────▼──────────┐  ┌─────────────┐                            │
│  │ Upstream       │  │ Plan catalog│                            │
│  │ Adapter        │  │ (YAML/DB)   │                            │
│  │ (pick one)     │  └─────────────┘                            │
│  └───┬────────┬───┘                                             │
└──────┼────────┼─────────────────────────────────────────────────┘
       │        │
       ▼        ▼
┌──────────────┐  ┌──────────────────────────────┐
│ OpenRouter   │  │ LiteLLM Proxy (on-prem)       │
│ (cloud SaaS) │  │ + dev's OpenAI/Anthropic keys │
│ dev's OR acct│  │ docker profile: litellm       │
└──────────────┘  └──────────────────────────────┘
```

**Adapter selection (one per deployment):**

| Adapter | Best for | Dev setup |
|---------|----------|-----------|
| **OpenRouter** | Fast start, 400+ models, one cloud bill | OpenRouter Management API key + credits |
| **LiteLLM** | Full on-prem, BYOK, no aggregator fee | LiteLLM in Compose + provider keys in `litellm/config.yaml` |

### 8.2 Request path (chat)

1. App calls `POST /v1/chat/completions` with `Authorization: Bearer aisplinter_user_token` OR dev key + `X-AISplinter-User-Id`
2. AISplinter resolves user + entitlement
3. If budget exhausted → `402` + webhook `budget.exhausted`
4. Map `model: "smart"` → upstream model id (from plan; shape depends on active adapter)
5. Forward via **active adapter** with **provisioned per-user credential**
6. Parse usage from response; append ledger row; debit budget
7. Return OpenAI-shaped response to app
8. If threshold crossed → webhook `budget.warning`

### 8.3 Data stores (V1)

| Store | Purpose |
|-------|---------|
| **PostgreSQL** | devs, users, entitlements, plans, upstream_key_refs, usage_ledger, webhook_deliveries |
| **Redis** (optional V1) | Rate limiting, idempotency cache |

### 8.4 Recommended tech stack (V1)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| API server | **TypeScript (Hono or Fastify)** or **Rust (Axum)** | Hono: fast iteration, shared types with UI packages. Rust: if Egocentric proxy stays Rust — pick one and document. **Default recommendation: TypeScript monorepo** for SDK parity. |
| DB | PostgreSQL 16 | Ledger + relational entitlements |
| Migrations | Drizzle or sqlx | Versioned schema |
| Packages | pnpm workspaces + Turborepo | SDK/UI co-location |
| UI | Svelte 5 + React 19 | Egocentric uses Svelte; React for wider adoption |
| Container | Docker Compose V2 | On-prem standard |

> **Decision for implementer:** If team prefers Rust API for parity with Egocentric Tauri backend, split repo: `aisplinter-server` (Rust) + `packages/*` (TS). TypeScript-only server is acceptable for V1.

---

## 9. Repository & package structure

```
aisplinter/                          # NEW REPO (not inside egocentric-code)
├── README.md
├── LICENSE                         # MIT for packages/, AGPL for apps/server
├── CONTRIBUTING.md
├── GOVERNANCE.md                   # Neutrality + Egocentric non-privilege
├── AGENTS.md                       # Instructions for AI coding agents (Cursor, etc.)
├── llms.txt                        # Machine-readable repo map for AI orchestration
├── openapi.yaml                    # OpenAPI 3.1 — source of truth for API + codegen
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── server/                     # API + proxy + webhooks
│   └── demo-next/                  # Minimal integrator demo
├── packages/
│   ├── core/                       # @aisplinter/core — HTTP client, types
│   ├── svelte/                     # @aisplinter/svelte — UI components
│   ├── react/                      # @aisplinter/react
│   └── stripe-bridge/              # @aisplinter/stripe-bridge — webhook helpers
├── adapters/
│   ├── openrouter/                 # Cloud aggregator adapter
│   └── litellm/                    # On-prem LiteLLM virtual-key adapter
├── infra/
│   └── litellm/
│       ├── config.yaml             # Provider keys + model list (dev-owned)
│       └── README.md
├── plans/
│   ├── default-plans.openrouter.yaml
│   └── default-plans.litellm.yaml
├── docs/
│   ├── quickstart.md
│   ├── api-reference.md
│   ├── self-host.md
│   ├── adapters/
│   │   ├── openrouter.md
│   │   └── litellm.md
│   ├── stripe-integration.md
│   ├── security.md
│   └── egocentric-integration.md   # Reference; app code stays external
└── examples/
    └── egocentric/                 # Pseudocode / snippets only if license allows
```

---

## 10. Core API specification (V1)

Base URL: `https://aisplinter.yourcompany.internal` (self-hosted)

Auth:

- **Dev key:** `Authorization: Bearer aisplinter_dev_…` — server-to-server
- **User session (optional):** `Authorization: Bearer aisplinter_sess_…` — short-lived, scoped

### 10.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/v1/plans` | List plan SKUs (public within dev tenant) |
| `POST` | `/v1/users/provision` | Create AISplinter user + upstream key |
| `GET` | `/v1/users/:id` | User + entitlement summary |
| `POST` | `/v1/users/:id/entitlement` | Set/update plan (also used by Stripe bridge) |
| `DELETE` | `/v1/users/:id/entitlement` | Revoke |
| `POST` | `/v1/chat/completions` | OpenAI-compatible proxy |
| `GET` | `/v1/users/:id/usage` | Usage summary current period |
| `POST` | `/v1/webhooks/stripe` | Inbound Stripe (dev configures Stripe → this URL) |
| `POST` | `/v1/admin/rotate-key/:userId` | Rotate upstream key |

### 10.2 `POST /v1/users/provision`

Request:

```json
{
  "external_user_id": "egocentric-user-uuid",
  "plan_sku": "ai_starter",
  "metadata": { "email": "optional@example.com" }
}
```

Response:

```json
{
  "aisplinter_user_id": "as_abc123",
  "session_token": "aisplinter_sess_…",
  "entitlement": {
    "plan_sku": "ai_starter",
    "budget_usd_remaining": 5.0,
    "period_ends_at": "2026-07-01T00:00:00Z"
  }
}
```

### 10.3 `POST /v1/chat/completions`

- Accept OpenAI schema (`model`, `messages`, `stream`, etc.)
- `model` may be **alias** (`fast`, `smart`) or full upstream id if allowed by plan
- Streaming: `text/event-stream` pass-through
- Errors: OpenAI-shaped + AISplinter extensions in `error.metadata`

### 10.4 Error codes

| HTTP | Code | Meaning |
|------|------|---------|
| 402 | `budget_exhausted` | Hard stop |
| 403 | `entitlement_missing` | User not provisioned |
| 403 | `model_not_allowed` | Plan forbids model |
| 429 | `rate_limited` | Dev-configured |
| 502 | `upstream_error` | OpenRouter or LiteLLM failure |

---

## 11. Upstream adapters: OpenRouter + LiteLLM (V1)

V1 ships **two first-class adapters**. Each deployment activates **exactly one** via `AISPLINTER_UPSTREAM_ADAPTER`. AISplinter API, entitlements, webhooks, and UI stay identical — only the upstream plumbing changes.

### 11.1 Adapter interface (shared)

All adapters implement the same contract:

```typescript
type UpstreamAdapterId = 'openrouter' | 'litellm';

interface UpstreamAdapter {
  readonly id: UpstreamAdapterId;

  /** Create or rotate per-user upstream credential */
  provisionUserKey(input: ProvisionInput): Promise<ProvisionResult>;

  /** Update spending cap when Stripe grants/upgrades plan */
  updateKeyBudget(keyRef: string, budgetUsd: number, period: 'monthly' | 'daily'): Promise<void>;

  /** Revoke on entitlement removal */
  revokeKey(keyRef: string): Promise<void>;

  /** OpenAI-compatible completion (non-stream + stream) */
  chatCompletions(
    req: OpenAIChatRequest,
    keyRef: string,
  ): Promise<OpenAIChatResponse | ReadableStream>;

  /**
   * Parse final usage from a completed request.
   * NON-STREAM: parse response JSON body.
   * STREAM: pass StreamAggregationResult from chunk collector (see §24.1).
   */
  parseUsage(source: UsageParseInput): UsageRecord;

  /**
   * Optional: estimate input tokens BEFORE upstream call for budget pre-check.
   * Default: conservative char/4 heuristic in shared util.
   */
  estimateInputTokens?(req: OpenAIChatRequest): number;
}

interface ProvisionInput {
  devId: string;
  aisplinterUserId: string;
  externalUserId: string;
  planSku: string;
  budgetUsd: number;
  period: 'monthly' | 'daily';
  allowedModels: string[]; // resolved model ids for this plan
}

interface ProvisionResult {
  keyRef: string;           // internal reference (encrypted blob in DB)
  upstreamKeyId?: string;     // provider-side id/hash for admin ops
}
```

**DB column:** `aisplinter_users.upstream_adapter` stores which adapter created the key (`openrouter` | `litellm`).

### 11.2 Global adapter config

```bash
# Which adapter is active for this deployment
AISPLINTER_UPSTREAM_ADAPTER=openrouter   # or: litellm

# App attribution (OpenRouter only; optional for LiteLLM)
AISPLINTER_APP_URL=https://yourapp.com
AISPLINTER_APP_NAME=YourApp
```

### 11.3 OpenRouter adapter

**When to use:** Fastest path to many models; dev has OpenRouter account with credits; OK with cloud upstream.

**Docs:** [OpenRouter Management API](https://openrouter.ai/docs/guides/overview/auth/management-api-keys)

#### Environment variables

```bash
AISPLINTER_UPSTREAM_ADAPTER=openrouter
OPENROUTER_MANAGEMENT_KEY=...          # Admin: create/update/delete keys
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

#### Provision flow

On `POST /v1/users/provision`:

1. `POST https://openrouter.ai/api/v1/keys` with:
   ```json
   {
     "name": "aisplinter-{devId}-{aisplinterUserId}",
     "limit": 5.0,
     "limit_reset": "monthly"
   }
   ```
2. Store returned `sk-or-v1-…` encrypted at rest (`AISPLINTER_SECRETS_MASTER_KEY`)
3. Return AISplinter session token only — never the raw OR key to client apps

#### Proxy flow

- `Authorization: Bearer sk-or-v1-…` (per-user key)
- Headers: `HTTP-Referer: AISPLINTER_APP_URL`, `X-OpenRouter-Title: AISPLINTER_APP_NAME`
- Model ids in plans use OpenRouter slugs: `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`

#### Plan YAML model aliases (OpenRouter example)

```yaml
model_aliases:
  fast: openai/gpt-4o-mini
  smart: anthropic/claude-3.5-sonnet
```

---

### 11.4 LiteLLM adapter

**When to use:** Fully on-premises; dev already has OpenAI/Anthropic/Azure keys; wants **zero** OpenRouter dependency; accepts running LiteLLM proxy alongside AISplinter.

**Docs:** [LiteLLM virtual keys](https://docs.litellm.ai/docs/proxy/virtual_keys), [BerriAI/litellm](https://github.com/BerriAI/litellm)

#### Architecture

```
AISplinter  →  LiteLLM Proxy (same Compose network)  →  OpenAI / Anthropic / …
              mints sk-litellm virtual keys per user
```

LiteLLM holds **provider master keys** in `infra/litellm/config.yaml`. End users never see LiteLLM or providers — same UX as OpenRouter path.

#### Environment variables

```bash
AISPLINTER_UPSTREAM_ADAPTER=litellm
LITELLM_BASE_URL=http://litellm:4000          # internal Compose DNS
LITELLM_MASTER_KEY=sk-...                    # LiteLLM admin / master key
LITELLM_VIRTUAL_KEY_MODE=per_user            # V1 only mode
```

#### Docker Compose profile

```bash
# OpenRouter-only (default) — no LiteLLM container
docker compose up

# On-prem LiteLLM stack
docker compose --profile litellm up
```

Services with profile `litellm`:

| Service | Image | Port |
|---------|-------|------|
| `litellm` | `ghcr.io/berriai/litellm:main-stable` | 4000 |
| `litellm-db` | `postgres:16` | internal (LiteLLM spend logs) |

Mount `infra/litellm/config.yaml` — **dev-owned secrets**, never committed.

#### Example `infra/litellm/config.yaml` (template)

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/LITELLM_DATABASE_URL
```

#### Provision flow

On `POST /v1/users/provision`:

1. `POST {LITELLM_BASE_URL}/key/generate` with master key auth:
   ```json
   {
     "key_alias": "aisplinter-{devId}-{aisplinterUserId}",
     "max_budget": 5.0,
     "budget_duration": "30d",
     "models": ["gpt-4o-mini", "claude-sonnet"],
     "metadata": { "aisplinter_user_id": "as_abc", "external_user_id": "…" }
   }
   ```
2. Store returned virtual key encrypted at rest
3. Return AISplinter session token to app

#### Proxy flow

- `POST {LITELLM_BASE_URL}/v1/chat/completions`
- `Authorization: Bearer <virtual-key>` (per-user)
- Model ids in plans use **LiteLLM model_name** aliases: `gpt-4o-mini`, `claude-sonnet`

#### Plan YAML model aliases (LiteLLM example)

```yaml
# plans/litellm-plans.yaml — use when AISPLINTER_UPSTREAM_ADAPTER=litellm
model_aliases:
  fast: gpt-4o-mini
  smart: claude-sonnet
```

Ship **`plans/default-plans.openrouter.yaml`** and **`plans/default-plans.litellm.yaml`** in repo; quickstart sets `AISPLINTER_PLANS_FILE` based on adapter.

#### Budget sync

When Stripe webhook upgrades plan:

- OpenRouter: `PATCH /api/v1/keys/{hash}` → update `limit`
- LiteLLM: `POST /key/update` → update `max_budget` for key alias

Both paths emit `entitlement.granted` webhook to dev app.

---

### 11.5 Choosing OpenRouter vs LiteLLM

| | **OpenRouter** | **LiteLLM** |
|--|----------------|-------------|
| **Setup time** | Minutes (one API key) | Hours (Compose + provider keys) |
| **Models** | 400+ via one account | Whatever dev configures |
| **Billing** | OpenRouter credits (+ ~5.5% top-up fee) | Direct to OpenAI/Anthropic/etc. |
| **Data path** | Cloud (openrouter.ai) | Stays on your network |
| **Per-user keys** | OR Management API | LiteLLM virtual keys |
| **Best for** | MVPs, many models, small teams | Regulated, on-prem, BYOK, cost control |

**Recommendation in docs:**

- **Quickstart / demo:** OpenRouter
- **Production on-prem (Egocentric-style):** LiteLLM profile
- **Same app code** — only env + plans file change

### 11.6 Adapter testing requirements (V1)

- [ ] Contract test suite run against **both** adapters (mocked HTTP)
- [ ] Integration test job: OpenRouter (optional secret in CI)
- [ ] Integration test job: LiteLLM Compose profile (required in CI)
- [ ] Provision → chat → budget exhaust → 402 verified on **both**

---

## 12. Entitlements & billing integration (V1)

### 12.1 Plan catalog

Ship two default plan files — model alias shapes differ by adapter:

- `plans/default-plans.openrouter.yaml` — OpenRouter slugs (`openai/gpt-4o-mini`)
- `plans/default-plans.litellm.yaml` — LiteLLM `model_name` values (`gpt-4o-mini`)

Example (`default-plans.openrouter.yaml`):

```yaml
plans:
  - sku: ai_trial
    display_name: AI Trial
    budget_usd: 0.50
    period: monthly
    model_aliases:
      fast: openai/gpt-4o-mini
    features: [chat]

  - sku: ai_starter
    display_name: AI Starter
    budget_usd: 5.00
    period: monthly
    model_aliases:
      fast: openai/gpt-4o-mini
      smart: anthropic/claude-3.5-sonnet
    features: [chat, email_summarize]

  - sku: ai_pro
    display_name: AI Pro
    budget_usd: 15.00
    period: monthly
    model_aliases:
      fast: openai/gpt-4o-mini
      smart: anthropic/claude-3.5-sonnet
      reasoning: anthropic/claude-3-opus
    features: [chat, email_summarize, tools]
```

Developers may override via mounted config volume. Set `AISPLINTER_PLANS_FILE` to match `AISPLINTER_UPSTREAM_ADAPTER`.

### 12.2 Stripe (developer-owned)

AISplinter provides **`@aisplinter/stripe-bridge`**:

- Maps Stripe Price ID → `plan_sku`
- Validates Stripe signature
- Calls internal entitlement update

Dev setup:

1. Create Stripe products/prices for `ai_starter`, `ai_pro`
2. Set metadata on Price: `aisplinter_plan_sku=ai_starter`
3. Point Stripe webhook to `https://aisplinter.example/v1/webhooks/stripe`
4. On `checkout.session.completed` → entitlement granted/extended

**AISplinter never stores Stripe secret keys in V2 hosted without explicit opt-in.** V1 self-host: dev puts `STRIPE_WEBHOOK_SECRET` in AISplinter env.

---

## 13. Webhooks (V1)

### 13.1 Outbound (AISplinter → developer app)

Configure: `AISPLINTER_DEV_WEBHOOK_URL` + `AISPLINTER_DEV_WEBHOOK_SECRET`

| Event | When |
|-------|------|
| `user.provisioned` | After successful provision |
| `entitlement.granted` | Plan activated |
| `entitlement.revoked` | Plan removed |
| `budget.warning` | Usage ≥ 80% of period budget |
| `budget.exhausted` | Hard cap hit |
| `usage.period_reset` | Monthly reset (if applicable) |
| `upstream.error` | Repeated upstream failures (optional) |

Payload envelope:

```json
{
  "id": "evt_…",
  "type": "budget.warning",
  "created_at": "2026-06-22T12:00:00Z",
  "data": {
    "aisplinter_user_id": "as_abc",
    "external_user_id": "…",
    "plan_sku": "ai_starter",
    "budget_usd_remaining": 1.02,
    "percent_used": 82
  }
}
```

Sign: `X-AISplinter-Signature: t=…,v1=…` (HMAC-SHA256, Stripe-style)

### 13.2 Inbound

- Stripe (documented)
- Optional manual admin API for support

---

## 14. Frontend SDK & UI (V1)

### 14.1 `@aisplinter/core`

```typescript
import { AisplinterClient } from '@aisplinter/core';

const splinter = new AisplinterClient({
  baseUrl: process.env.AISPLINTER_URL,
  devKey: process.env.AISPLINTER_DEV_KEY, // server-side only
});

// Server route: provision
const user = await splinter.users.provision({
  externalUserId: user.id,
  planSku: 'ai_starter',
});

// Server route: chat (or client with session token)
const reply = await splinter.chat.complete({
  sessionToken: user.sessionToken,
  model: 'smart',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### 14.2 Error handling — `AisplinterError` + 402 UX (V1 requirement)

Raw HTTP `402` is correct for the API. **The SDK/UI must make budget exhaustion trivial to handle** — this is a primary product surface, not an edge case.

#### `@aisplinter/core` — typed errors

```typescript
export class AisplinterError extends Error {
  readonly status: number;
  readonly code: string; // e.g. 'budget_exhausted'
  readonly metadata?: Record<string, unknown>;
}

export function isAisplinterError(e: unknown): e is AisplinterError;
export function isBudgetExhausted(e: unknown): boolean;
```

All `aisplinter.chat.complete()` and `aisplinter.chat.stream()` calls **throw `AisplinterError`** on non-2xx with parsed `error.code` from response body:

```json
{
  "error": {
    "message": "Monthly AI budget exhausted",
    "type": "budget_error",
    "code": "budget_exhausted",
    "metadata": {
      "plan_sku": "ai_starter",
      "budget_usd_remaining": 0,
      "upgrade_url": "https://yourapp.com/billing"
    }
  }
}
```

Server **must** include `upgrade_url` when dev configures `AISPLINTER_UPGRADE_URL_TEMPLATE` or per-plan checkout links in YAML.

#### Global interception pattern

`<AisplinterProvider>` accepts optional `onBudgetExhausted`:

```svelte
<AisplinterProvider
  {baseUrl}
  {fetchSession}
  onBudgetExhausted={(ctx) => {
    showOutOfBudget = true;
    upgradeUrl = ctx.upgradeUrl;
  }}
>
```

If `onBudgetExhausted` is set, **any** child chat/stream that hits `402` triggers it automatically (no try/catch required in app code).

#### `@aisplinter/svelte` components

| Component | Purpose |
|-----------|---------|
| `<AisplinterProvider>` | Context: baseUrl, fetchSession |
| `<EnableAIButton>` | Triggers provision flow |
| `<PlanList>` | Renders plans from `GET /v1/plans` |
| `<UsageBanner>` | Shows remaining budget |
| `<OutOfBudget>` | Modal/sheet triggered by `402` or `onBudgetExhausted`; shows upgrade CTA |
| `<OutOfBudgetGate>` | Wrapper: renders children or `<OutOfBudget>` when session budget is 0 |
| `<AisplinterChatInput>` | Optional: disables send + shows inline banner on `budget_exhausted` mid-stream |

Design: **unstyled primitives** + optional `@aisplinter/theme-default` CSS.

**Acceptance (V1):** demo-next and Egocentric reference must show `<OutOfBudget>` modal within one integration path — no raw 402 in UI.

### 14.3 `@aisplinter/react`

Parity exports for same components, including `AisplinterProvider`, `AisplinterError`, `onBudgetExhausted`.

### 14.4 Mid-stream budget exhaustion

If upstream completes but ledger debit would exceed cap **after** stream ends:

1. Server still closes stream to client normally (don't truncate mid-token)
2. Final ledger write marks period **exhausted**
3. **Next** request returns `402`
4. Optional SSE terminal event: `data: {"aisplinter_event":"budget_exhausted"}` before `[DONE]`

UI: `<AisplinterChatInput>` listens for terminal event and opens `<OutOfBudget>` without waiting for next request.

---

## 15. Self-host deployment (V1)

### 15.1 Docker Compose services

**Core (always):**

| Service | Image | Port |
|---------|-------|------|
| `aisplinter-api` | `ghcr.io/aisplinter/server:latest` | 8080 |
| `postgres` | `postgres:16` | internal |
| `redis` | `redis:7` | internal (optional) |

**Profile `litellm` (on-prem upstream):**

| Service | Image | Port |
|---------|-------|------|
| `litellm` | `ghcr.io/berriai/litellm:main-stable` | 4000 |
| `litellm-db` | `postgres:16` | internal |

```bash
# OpenRouter upstream (no LiteLLM container)
docker compose up

# LiteLLM upstream (full on-prem)
docker compose --profile litellm up
```

### 15.2 Minimum hardware

| Profile | CPU | RAM |
|---------|-----|-----|
| OpenRouter only | 1 vCPU | 2 GB |
| + LiteLLM profile | 2 vCPU | 4 GB |

### 15.3 `.env.example` (essential)

```bash
# Server
AISPLINTER_PUBLIC_URL=https://aisplinter.internal.example
AISPLINTER_SECRETS_MASTER_KEY=…   # 32-byte base64
AISPLINTER_DEV_API_KEY=aisplinter_dev_… # bootstrap first dev

# Database
DATABASE_URL=postgres://aisplinter:aisplinter@postgres:5432/aisplinter

# Upstream adapter (pick one)
AISPLINTER_UPSTREAM_ADAPTER=openrouter   # or litellm
AISPLINTER_PLANS_FILE=/config/default-plans.openrouter.yaml

# --- OpenRouter (when AISPLINTER_UPSTREAM_ADAPTER=openrouter) ---
OPENROUTER_MANAGEMENT_KEY=…
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# --- LiteLLM (when AISPLINTER_UPSTREAM_ADAPTER=litellm) ---
LITELLM_BASE_URL=http://litellm:4000
LITELLM_MASTER_KEY=sk-…
OPENAI_API_KEY=sk-…          # dev provider keys → litellm config
ANTHROPIC_API_KEY=sk-ant-…

# App attribution (OpenRouter)
AISPLINTER_APP_URL=https://yourapp.com
AISPLINTER_APP_NAME=YourApp

# Webhooks
AISPLINTER_DEV_WEBHOOK_URL=https://yourapp.com/api/aisplinter-webhook
AISPLINTER_DEV_WEBHOOK_SECRET=whsec_…

# Stripe bridge (optional)
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_MAP='{"price_123":"ai_starter"}'
```

### 15.4 On-prem requirements

| Adapter | Outbound HTTPS |
|---------|----------------|
| OpenRouter | `openrouter.ai` |
| LiteLLM | Provider endpoints only (openai.com, anthropic.com, etc.) — **no OpenRouter required** |

- Inbound HTTPS from app + Stripe (if used)
- No outbound telemetry required (V1 principle)

---

## 16. Security & operations (V1)

### 16.1 Secrets

- Encrypt upstream keys at rest
- Never log raw keys or message bodies (configurable redaction)
- Dev API key rotatable via admin endpoint

### 16.2 Threat model (V1 basics)

| Risk | Mitigation |
|------|------------|
| Session token theft | Short TTL (1h), refresh via server |
| Budget bypass | All completions through proxy; no client upstream keys |
| Webhook replay | Timestamp + idempotency keys |
| Stripe spoof | Signature verification |

### 16.3 Observability

- Structured JSON logs
- `GET /metrics` Prometheus format (optional V1.1)
- Request id header `X-AISplinter-Request-Id`

### 16.4 Upgrades

- Documented migration runner
- Semantic versioning for API

---

## 17. Reference integration: Egocentric

Egocentric is **not** part of this repo. Document integration only.

### 17.1 Current state (external app)

- `OnboardingAiModelSection.svelte` — BYOK OpenAI/Anthropic/Groq
- `agent.rs` — direct provider HTTP calls
- `egocentric.me` — Stripe, auth, `canUseAi` license flag

### 17.2 Target state with AISplinter

| Layer | Change |
|-------|--------|
| Onboarding | Replace default BYOK with `<PlanList>` + Stripe checkout (existing) |
| Tauri | `provider: "aisplinter"` → call local/remote AISplinter proxy with session token |
| Web | Stripe webhook → AISplinter entitlement; AISplinter webhook → refresh UI |
| BYOK | Move under Advanced settings |

### 17.3 Egocentric neutrality checklist

- [ ] Egocentric uses public npm packages only
- [ ] No hardcoded Egocentric URLs in AISplinter core
- [ ] Egocentric listed in docs as **example**, not sponsor-only features

---

## 18. V1 milestones & acceptance criteria

### Milestone 0 — Repo bootstrap (Week 1)

- [ ] Monorepo, CI, LICENSE, GOVERNANCE.md
- [ ] **`llms.txt` stub + `AGENTS.md` + `openapi.yaml` skeleton** (§24.3)
- [ ] Docker Compose starts empty API + Postgres
- [ ] `GET /health` returns 200

### Milestone 1 — Adapter framework + OpenRouter (Week 2)

- [ ] `UpstreamAdapter` interface + factory (`AISPLINTER_UPSTREAM_ADAPTER`)
- [ ] OpenRouter adapter: provision, update budget, revoke, proxy
- [ ] Keys encrypted at rest
- [ ] Unit tests with mocked OpenRouter

### Milestone 1b — LiteLLM adapter (Week 3)

- [ ] LiteLLM Compose profile (`infra/litellm/`)
- [ ] LiteLLM adapter: virtual key provision + proxy
- [ ] `default-plans.litellm.yaml` + docs/adapters/litellm.md
- [ ] Integration test: Compose profile end-to-end
- [ ] Budget exhaust → 402 on LiteLLM path

### Milestone 2 — Proxy hardening (Week 4)

- [ ] `POST /v1/chat/completions` non-streaming (both adapters)
- [ ] Model alias resolution (adapter-aware)
- [ ] Usage ledger write (non-stream)
- [ ] **Streaming pass-through with chunk aggregator** (see §24.1)
- [ ] **402 response shape** + `upgrade_url` metadata
- [ ] Budget overshoot test: 0 failures in CI (stream + non-stream)

### Milestone 3 — Entitlements + plans (Week 5)

- [ ] YAML plan loader (both plan files)
- [ ] `entitlement.granted` / `budget.*` webhooks
- [ ] Stripe inbound webhook + `@aisplinter/stripe-bridge`
- [ ] Budget update on both adapters when plan changes

### Milestone 4 — SDK + UI (Week 6–7)

- [ ] `@aisplinter/core` incl. `AisplinterError`, `isBudgetExhausted`, stream helpers
- [ ] `@aisplinter/svelte` — EnableAIButton, PlanList, UsageBanner, **OutOfBudget modal**, AisplinterProvider + `onBudgetExhausted`
- [ ] `@aisplinter/react` parity
- [ ] `apps/demo-next` — **402 → OutOfBudget** demo (README GIF)
- [ ] **`openapi.yaml` complete** — all routes + `budget_exhausted` error schema

### Milestone 5 — Docs & hardening (Week 8)

- [ ] Quickstarts: **OpenRouter path** (≤ 30 min) + **LiteLLM path** (≤ 45 min)
- [ ] Security.md, self-host.md, adapters/*
- [ ] Load test: 100 concurrent **streams**, no budget overshoot (both adapters)
- [ ] **`llms.txt` complete** — mirrors §24.3 index

### V1 release criteria

- [ ] All Milestone 0–5 complete
- [ ] **Both adapters** pass contract + integration tests
- [ ] No Egocentric-specific code in server
- [ ] CHANGELOG + v1.0.0 tag

---

## 19. Version 2 preview (commercial services)

V2 adds **optional managed services** around the same OSS core — **no proprietary fork required**.

### 19.1 V2 offerings (high level)

| Service | Description |
|---------|-------------|
| **AISplinter Cloud** | Hosted aisplinter-api, managed Postgres, TLS, scaling |
| **Freemium tiers** | Free dev tier; Pro/Team paid monthly |
| **Managed Stripe Connect helper** | Optional: AISplinter facilitates AI plan checkout with platform fee (opt-in) |
| **Wholesale deals catalog** | Hosted-only: optimized upstream pricing passed partially to customers |
| **Enterprise** | VPC deploy assist, SLA, SSO, audit export |
| **Support & SLAs** | Paid support contracts |

### 19.2 V2 non-goals

- V2 must not break self-host V1 API compatibility
- Core features used by self-hosters stay in OSS; **operational convenience** is what sells

### 19.3 V2 architecture delta

```
Same @aisplinter/* SDK
  → AISPLINTER_URL=https://api.aisplinter.cloud (instead of self-hosted)
  → Optional: aisplinter.cloud dashboard, team mgmt, billing to AISplinter operator
```

---

## 20. Monetization model (V2+)

| Stream | Model | Notes |
|--------|-------|-------|
| **Hosted Pro** | $29–99/mo per dev project | Higher limits, logs retention, email support |
| **Hosted Team** | $199+/mo | SSO, staging envs, SLA |
| **Usage platform fee** | 2–5% on AI spend | **Only** if dev uses optional Connect billing — not on self-host |
| **Enterprise** | Custom annual | On-prem support, training |
| **Grants/sponsors** | OpenCollective etc. | Optional for pure OSS costs |

**V1 revenue: $0** — intentional.

---

## 21. Growth & community strategy

1. **Launch** with Egocentric case study (external blog)
2. **Docs** optimized for AI agents (`llms.txt`, OpenAPI spec)
3. **Demo app** in repo (Next.js)
4. **Hacker News / dev Twitter** — “self-hosted Stripe-like layer for AI”
5. **Adapters bounty** — community adapters (Helicone, direct OpenAI) after V1
6. **Governance** — accept external maintainers early

---

## 22. Open questions & decisions log

| ID | Question | Status | Decision |
|----|----------|--------|----------|
| D1 | API server language: TS vs Rust? | Open | **Recommend TS** for V1 unless Egocentric team commits to Rust |
| D2 | Per-user upstream keys vs pooled + ledger? | Open | **Per-user keys** on both adapters (OR Management API + LiteLLM virtual keys) |
| D7 | Default quickstart adapter? | **Decided** | **OpenRouter** (fastest); LiteLLM documented as production on-prem path |
| D8 | Egocentric production adapter? | Open | **Recommend LiteLLM** for on-prem / BYOK; OpenRouter for dev/staging |
| D3 | Project name final? | **Decided** | **AISplinter** — slug `aisplinter` (npm, Docker, GitHub org) |
| D4 | Foundation vs personal repo? | Open | Start GitHub org `aisplinter` |
| D5 | Stream support in V1.0 or V1.1? | **Decided** | **V1.0 must-have**; ledger accuracy is non-negotiable (§24.1) |
| D6 | Include basic admin UI in V1? | Open | **Defer** — API + Swagger only |
| D9 | Pre-request budget reservation? | **Decided** | **Yes** — soft reserve input estimate; reconcile on completion (§24.1) |
| D10 | 402 UX in SDK mandatory? | **Decided** | **Yes** — AisplinterError + OutOfBudget + onBudgetExhausted (§14.2) |
| D11 | llms.txt + OpenAPI in M0 or M4? | **Decided** | **M0 stub, M4 complete** — agents use from day one (§24.3) |

---

## 24. Strategic execution notes (critical paths)

This section captures **execution traps** that determine whether V1 feels production-ready. Treat as blocking requirements, not nice-to-haves.

### 24.1 Streaming token ledger accuracy (Trap #1)

**Problem:** OpenAI-compatible `text/event-stream` responses often omit final `usage` until the last chunk — or omit it entirely. Debiting budget only from a reliable JSON field causes **budget overshoot** or **under-charge**.

**Required architecture: reserve → stream → reconcile**

```
1. PRE-FLIGHT (before upstream)
   - Check entitlement not exhausted
   - estimateInputTokens(messages) → soft_reserve_usd
   - If remaining_budget < reserve → 402 immediately
   - Write ledger row: type=RESERVE, status=pending

2. STREAM (pass-through to client)
   - Tee stream: client + chunk aggregator
   - Aggregator collects:
     - concatenated delta content (for output token estimate fallback)
     - any chunk with usage / usage_metadata / x-litellm-* headers
     - final chunk if provider sends usage there

3. POST-FLIGHT (after stream closes)
   - parseUsage({ mode: 'stream', aggregation }) → UsageRecord
   - If usage missing: fallback estimate (chars/4 or tiktoken if bundled)
   - Compute actual_usd via adapter pricing table
   - Ledger: CONSUMPTION (actual) + RELEASE reserve delta
   - If budget now exhausted → webhook budget.exhausted
   - If actual > remaining (race): mark overage flag; next request 402
```

**StreamAggregationResult shape (shared types):**

```typescript
interface StreamAggregationResult {
  model: string;
  chunks: number;
  contentLength: number;
  providerUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  rawFinalChunk?: unknown;
  headers?: Record<string, string>;
}
```

**Adapter-specific notes:**

| Adapter | Usage in stream | Fallback |
|---------|-----------------|----------|
| OpenRouter | Often in final SSE chunk `usage` field | Estimate from content length |
| LiteLLM | May expose `usage` in response; check docs for stream | LiteLLM callback headers if configured |

**Testing (mandatory in CI):**

- [ ] Fixture: stream **with** usage in final chunk → exact debit
- [ ] Fixture: stream **without** usage → estimate debit within ±15% of recorded integration test
- [ ] Fixture: concurrent streams same user → no double overshoot (row lock on entitlement)
- [ ] Load test: 100 streams, **zero** budget exceeded beyond 1 request grace (document grace policy)

**Grace policy (document in API):** At most **one** request may complete slightly over cap if usage unknown until end; **next** request hard-402. Never allow unbounded overshoot.

### 24.2 The 402 hard-stop UX (Trap #2)

**Problem:** `402 budget_exhausted` is elegant for machines; product designers need **one line of integration** to show a paywall modal.

**API contract (server):**

- Always return structured JSON error body with `code: "budget_exhausted"`
- Include `metadata.upgrade_url` when configured
- Include `metadata.percent_used`, `plan_sku`, `budget_usd_remaining`

**SDK contract (client):**

- `AisplinterError` with `isBudgetExhausted()`
- `<AisplinterProvider onBudgetExhausted>` global hook
- `<OutOfBudget>` — unstyled modal primitive with slots for branding
- `<AisplinterChatInput>` — disables + inline message on exhaustion

**Why this sells the product:** Devs adopt Stripe Elements for the same reason — **payments UX in a box**. AISplinter wins when **budget exhaustion UX** is as polished as **budget enforcement**.

**Demo requirement:** `apps/demo-next` must intentionally exhaust a trial budget and show modal — recorded in README GIF.

### 24.3 AI-orchestration multiplier (Trap #3 — opportunity)

**Problem:** Without machine-readable repo structure, AI agents re-discover architecture every session and drift from the plan.

**Repo must ship from Milestone 0:**

| File | Purpose |
|------|---------|
| `llms.txt` | Repo map: packages, env vars, milestone order, “do not implement V2” |
| `openapi.yaml` | OpenAPI 3.1 — endpoints, error schemas including `402` |
| `AGENTS.md` | Cursor/agent rules: adapter interface, ledger reserve flow, test requirements |
| `docs/architecture.md` | Diagrams from §8 + money flow from §25 |

**`llms.txt` minimum sections:**

1. Project one-liner + license split (MIT SDK / AGPL server)
2. Directory map
3. Implementation order (Milestones 0–5)
4. Critical paths (§24.1 streaming, §24.2 402 UX)
5. Env var index
6. Explicit non-goals (V2, MoR, Egocentric hooks)

**OpenAPI requirements:**

- All `/v1/*` routes documented
- Shared `ErrorResponse` schema with `code` enum including `budget_exhausted`
- Examples for provision, chat, 402

**Why this matters:** This repo is **designed for rapid AI-assisted implementation**. Clean boundaries + OpenAPI + llms.txt = agents implement Milestones without inventing parallel architecture.

### 24.4 License split reminder (monetization enabler)

| Artifact | License | Rationale |
|----------|---------|-----------|
| `packages/*` (SDK, UI) | **MIT** | Maximum adoption; devs embed freely |
| `apps/server`, adapters | **AGPL-3.0** | Hosted competitors must contribute or license |
| Docs, plans, openapi | **CC BY or MIT** | Share freely |

Same playbook as Plausible, Supabase, GitLab: **open core + paid convenience in V2**, not proprietary SDK.

---

## 25. Money flow & payments (developer FAQ)

### Can user payment go directly to OpenRouter?

**No.** OpenRouter bills the **account owner** (the developer). End users cannot top up your OpenRouter account via API.

### Actual flow

```
User pays developer (Stripe)  →  developer's Stripe balance
Developer tops up OpenRouter / pays OpenAI invoice  →  upstream pool
AISplinter  →  per-user key limits enforce plan caps on that pool
```

### Does the developer "hold" user money?

- **No custodial wallet required** — use **subscriptions + entitlements**, not prepaid user balances in AISplinter DB
- **Yes, developer receives payment first** — on **developer's Stripe account** (not AISplinter's)
- **AISplinter V1 does not process payments** — only maps Stripe webhooks → entitlements

### Does AISplinter need Stripe Connect / MoR?

**Not in V1.** Developer uses existing Stripe. AISplinter receives entitlement webhooks (from dev app or `@aisplinter/stripe-bridge`).

### LiteLLM path

User pays developer → developer's OpenAI/Anthropic keys used → provider invoices developer. Same pattern, no OpenRouter.

### One-line for docs

> Developers collect AI subscription revenue on their own Stripe account and fund their own upstream provider account; AISplinter maps payments to entitlements and enforces per-user budgets — it is not a payment processor.

---

## 23. Glossary

| Term | Definition |
|------|------------|
| **Dev / tenant** | Application team integrating AISplinter |
| **External user id** | Dev’s own user identifier |
| **AISplinter user id** | Internal id assigned by AISplinter |
| **Plan SKU** | Named entitlement package (`ai_starter`) |
| **Model alias** | Abstract model name (`smart`) mapped upstream |
| **Provision** | Create user + upstream credential + entitlement |
| **Upstream adapter** | Plugin: **OpenRouter** (cloud) or **LiteLLM** (on-prem) in V1 |
| **MoR** | Merchant of record — **out of V1 scope** |
| **RESERVE / CONSUMPTION** | Ledger pattern: soft-hold before stream, reconcile after (§24.1) |
| **AisplinterError** | Typed SDK error; `code: budget_exhausted` → `<OutOfBudget>` (§14.2) |

---

## Appendix A — Developer pitch (copy for README)

### Why install AISplinter for free?

You get a **production-ready AI backend** on your premises: user provisioning, scoped upstream keys, OpenAI-compatible proxy, budget enforcement, Stripe entitlement bridge, webhooks, and UI components — with your choice of **OpenRouter** (fast, many models) or **LiteLLM** (fully on-prem, your provider keys). Users never see either upstream.

### Why pay monthly (V2)?

You pay for **managed hosting, scaling, support, and ops** — not for permission to use the open-source code.

---

## Appendix B — Instructions for AI agents implementing this project

When building from this plan:

1. **Create a new repository** — do not embed in egocentric-code
2. Implement **Milestones 0→5** in order; do not skip entitlement enforcement before proxy
3. **Never** hardcode Egocentric URLs or credentials
4. Use **OpenRouter Management API** and **LiteLLM virtual keys** docs as provisioning sources of truth
5. Implement **both adapters** before V1.0 tag; shared contract tests required
6. All money flows stay **external** in V1 (developer’s Stripe)
7. Prefer **thin, testable modules**: adapter registry, entitlement, ledger, proxy, webhooks
8. Ship **demo-next** with env switch for OpenRouter vs LiteLLM
9. Document every env var in `.env.example` (grouped by adapter)
10. Write OpenAPI 3.1 spec alongside implementation — **`budget_exhausted` error is required**
11. Implement **reserve → stream → reconcile** ledger (§24.1) before marking streaming done
12. SDK **must** ship `AisplinterError` + `onBudgetExhausted` + `<OutOfBudget>` (§14.2)
13. V2 features go in `docs/v2-roadmap.md` — **do not implement in V1 repo scope**

---

*End of plan.*
