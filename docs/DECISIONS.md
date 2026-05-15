# Rocket Lease — Architectural Decisions

Single source of truth for the architectural decisions taken before and during the project. Each row links to its ADR (when written). Update this file when a decision changes.

## Stack

| # | Topic | Decision |
|---|-------|----------|
| 1 | Docs strategy | Per-repo `AGENTS.md` + cross-cutting docs in `api/docs/` (ADRs, CONTEXT, DECISIONS, CONVENTIONS). web and contracts AGENTS.md link there. |
| 2 | Frontend | Progressive Web App (PWA). Vite + React + TypeScript. Tailwind + shadcn/ui. `vite-plugin-pwa` for manifest + service worker. Capacitor wrap available as future exit path to App Store / Play Store (no commit v1). Pivoted from React Native + Expo (see ADR-0006). |
| 3 | Backend | NestJS (Node + TS). |
| 4 | Backend pattern | Pragmatic clean architecture: 3 layers per feature module — `controllers/`, `services/`, `repositories/` — with explicit interfaces. Entities = plain classes, no ORM decorator leak. |
| 5 | Database | Postgres on Supabase + Prisma (schema-first, generated types, migrations in repo). |
| 6 | Contracts | TS package consumed as **source via `link:../contracts` + tsconfig paths** by api and web. Zod schemas (source of truth) + `z.infer` types + thin typed API client. No npm publish in day-to-day flow. See ADR-0007 (supersedes the publish/versioning model of ADR-0003; the Zod + thin-client *shape* is unchanged). |
| 14 | Auth | Supabase Auth. NestJS verifies JWT via Supabase secret + `jose`. RLS policies in migrations as defense-in-depth. |
| 18 | Web UI | Tailwind + shadcn/ui (copy-paste components). Tokens in `tailwind.config.ts` (or `@theme` block if Tailwind v4). Mobile-first layouts (375px baseline, scale up via `sm:` / `md:`). |

## Branching, CI, Quality Gates

| # | Topic | Decision |
|---|-------|----------|
| 7 | Branching | `feature/*` → `dev` → `main`. Squash merge. AI does NOT open PRs (architects do, after review). No required reviewer count. Hotfix: `hotfix/*` → main + back-merge to dev. **All commits + PR titles must follow Conventional Commits** (enforced by Husky `commit-msg` hook locally + `commitlint` in CI). `--no-verify` forbidden. |
| 8 | Shared workflows + canonical rules | Each repo owns its own `.github/workflows/`. The infra repo was dismantled (sprint 2 retro); rules that are genuinely cross-repo live in `api/docs/CONVENTIONS.md`. |
| 9 | CI tooling | GitHub Actions. One workflow per repo, no reusable cross-repo workflows. pnpm. |
| 10 | Coverage | Per-repo gates: contracts (vitest), api (jest), web (vitest). Floors set in each repo's test config. No cross-repo drift check. |
| 11 | Linter + types + size | typescript-eslint strict-type-checked. tsconfig: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Bans: `any`, `!` non-null assertion, `@ts-ignore` (use `@ts-expect-error <reason>`), unjustified `eslint-disable`. Size caps: 50 lines/fn, 300/file, complexity 10, 4 params, depth 4. jscpd duplication ≤ 3%. |
| 12 | Tests | Unit + integration on every PR. Playwright e2e on `dev → main` (Chromium, mobile viewport — Pixel 5 / iPhone 13 presets). Lighthouse PWA audit on `dev → main`. Forbidden: mocking DB in api integration (use testcontainers Postgres). |
| 28 | Pre-commit + commit-msg | Husky `pre-commit` (lint-staged: ESLint + Prettier on staged files), Husky `commit-msg` (commitlint enforcing Conventional Commits on every commit), Husky `pre-push` (gitleaks). `--no-verify` forbidden — fix the issue, do not skip. |
| 29 | Rate limit | `@nestjs/throttler`: 60 req/min per IP global, 10 req/min on auth endpoints. |
| 30 | Error format | RFC 7807 Problem Details: `{ type, title, status, detail, code, instance }`. NestJS exception filter standardizes. Error codes exported from `contracts`. |

## Deploy & Environments

| # | Topic | Decision |
|---|-------|----------|
| 15 | API deploy | Containerize via Dockerfile in `api/`. CI builds + pushes to GHCR on dev/main merge. Runtime target: GCP Cloud Run (likely, not committed). |
| 16 | Environments | Local + prod only. `dev` branch = integration buffer (full CI runs, no deploy). `main` = prod deploy with manual approval. PR preview deploys: optional later. |
| 17 | Secrets | Layered: `.env.local` (gitignored, per-repo `.env.example` documents shape) + GitHub Actions secrets + GCP Secret Manager (when GCP lands). Local sharing via team password manager + onboarding doc. gitleaks in CI + pre-commit. |
| 18b | Observability | None v1. `/health` endpoint required (Cloud Run liveness probe). Add Sentry/pino later if needed. |

## Workflow

| # | Topic | Decision |
|---|-------|----------|
| 13 | AI execution + tickets | Each architect runs Claude locally, reviews diff, opens PR. Tickets in Trello. No codebase issue tracker. |

## Domain & Cross-Cutting

| # | Topic | Decision |
|---|-------|----------|
| 20 | Mobile-first scope | Mobile-first PWA (single codebase, served as web app). Capacitor wrap available later if App Store / Play Store presence becomes a requirement; web build remains source of truth. |
| 21 | External providers (payment, identity) | Stubbed v1. Built behind ports (`PaymentService`, `IdentityVerificationService` interfaces). Stub impls return fake success. Real adapters drop in later without touching business logic. |
| 22 | Reservation concurrency | Postgres EXCLUDE constraint (`btree_gist`) on `(vehicle_id, tstzrange(start_at, end_at))` filtered by active statuses. 10-min hold during checkout (`pending_payment` state with TTL cron). Idempotency-Key header on reservation + payment endpoints (24h replay window). |
| 23 | Multi-role users | Single User entity with flags: `isConductor` (default true), `isRentador` (false → true on first vehicle publish). Screens gated by flags. Permissions per-action, not per-user-type. |
| 24 | File uploads | Supabase Storage. Buckets: `vehicle-photos` (public-read), `id-documents` (private, signed URLs only). |
| 25 | Maps | Google Maps JS SDK (via `@vis.gl/react-google-maps` or `@react-google-maps/api`). API key restricted by HTTP referrer. Reconsider Leaflet + OSM if Google Maps quota becomes a concern. |
| 26 | Push notifications | Web Push API (VAPID) via service worker. Subscription persisted on User. NestJS sends via `web-push` (Node lib). iOS limitation: only works after PWA installed via "Add to Home Screen" on iOS 16.4+. If real push reach matters later, switch to Capacitor wrap + FCM/APNs (separate ADR). Stub during dev (no-op log). |
| 27 | i18n | None v1. Hardcode Spanish (rioplatense). String constants centralized in `src/i18n/es.ts` per repo to ease later i18n. |
| 31 | Date/time | UTC in DB + JSON. Reservations use `tstzrange`. Web displays in `America/Argentina/Buenos_Aires` via `date-fns-tz`. |
| 32 | Money | Smallest unit (cents) as integer. Currency code stored. No floats. Display via `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`. |
| 33 | Domain glossary | `CONTEXT.md` per repo. Spanish terms canonical (Rentador, Conductor, Reserva, Voucher, Set de reglas). Code identifiers in English (`Reservation`, `Vehicle`), domain language Spanish in user-facing text + comments where relevant. |

## Reservation State Machine

```
pending_payment ──(payment ok)──▶ confirmed ──(QR pickup)──▶ in_progress ──(QR return)──▶ completed
       │                                │                          │
       └─(TTL 10 min)─▶ expired         ├─(user cancels)─▶ cancelled_with_refund
                                        └─(rentador cancels)─▶ rejected
                       confirmed/in_progress ─(no return)─▶ no_show
```

## Module Map (api)

`auth`, `users`, `vehicles`, `search`, `reservations`, `payments`, `contracts` (digital signing), `reviews`, `reputation`, `levels`, `notifications`, `support` (FAQ/chat/disputes), `dashboard` (rentador metrics), `geo` (maps/nearby), `pricing` (bulk + tiered), `identity` (DNI/license verification — stubbed).

## Sprint allocation (from Cronograma)

- Sprint 1 (35 SP): auth, vehicle CRUD, search basics, FAQ
- Sprint 2 (40 SP): reservation, payment (stub), QR voucher, retire/return, rules sets, panel rentadora
- Sprint 3 (58 SP): identity verification (DNI/license/foreign — stub), payment methods mgmt, bank account
- Sprints 4–7: remaining features (reviews, reputation, levels, dashboard metrics, notifications, disputes, map, recommendations, bulk pricing, accessibility filters, cancellation policies, etc.)

Per-sprint user stories listed in `Artefactos_RocketLease.xlsx` → "Cronograma" + "Backlog-US" sheets.
