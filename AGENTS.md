# api — Agent Instructions

NestJS backend for Rocket Lease. TypeScript, Postgres on Supabase via Prisma, Supabase Auth (JWT verified locally), pragmatic clean architecture.

## Canonical rules (do not duplicate; defer to infra)

For branching, PR gates, TS strictness, lint config, coverage thresholds, error format (RFC 7807), date/money/IDs, concurrency policy, provider stubbing pattern, pre-commit hooks: see `<org>/infra` repo, file `playbook/canonical-rules.md`, sections §1–§12.

Domain glossary (Spanish canonical): `<org>/infra/playbook/CONTEXT.md`. New domain terms must be added there in the same PR that introduces them.

Cross-cutting ADRs: `<org>/infra/docs/adr/`. This repo holds backend-specific ADRs in `docs/adr/`.

## Layer rules (this repo)

Per-feature module under `src/modules/<feature>/`:

```
controllers/         # HTTP entry points; DTO validation via nestjs-zod
services/            # business logic, orchestration, transactions
repositories/
  <feature>.repository.ts          # interface (abstract class + DI token)
  prisma-<feature>.repository.ts   # Prisma impl
entities/            # plain TS classes; no @prisma/orm decorators
dto/                 # Zod schemas re-exported from @<org>/contracts
events/              # domain events emitted on state changes
<feature>.module.ts
```

Hard rules (block PR via review, lint where possible):

1. Controllers call services. Never repositories or Prisma directly.
2. Services depend on repository **interfaces**, injected by DI token. No `PrismaService` import in services.
3. Entities are plain TS. Prisma model types live only inside repositories; mapped to entities at the repository boundary.
4. Cross-module access only through the public service contract. No `repo.findById()` from another module's controller.
5. External providers (payment, identity, push, storage) wrapped behind interfaces. See `infra/docs/adr/0005-providers-stubbed.md`. Stubs in `infrastructure/`. Never branch on `process.env.PROVIDER` inside services — that decision happens in the module wiring.
6. Reservations: status transitions only via `ReservationsService`. Never update `status` from another module. See `infra/docs/adr/0004-reservation-concurrency.md`.

## Modules (planned)

`auth`, `users`, `vehicles`, `search`, `reservations`, `payments`, `contracts` (digital signing of rental terms; not to be confused with the `@<org>/contracts` package), `reviews`, `reputation`, `levels`, `notifications`, `support`, `dashboard`, `geo`, `pricing`, `identity`.

Sprint allocation per module: `<org>/infra/playbook/DECISIONS.md` → "Sprint allocation" section.

## Persistence

- Prisma. Schema in `prisma/schema.prisma`.
- Migrations: `prisma migrate dev` locally; `prisma migrate deploy` in CI/prod.
- All migrations checked in. Never edit a migration after merge — add a new one.
- Reservations table requires `btree_gist` extension and an EXCLUDE constraint (see ADR-0004). The migration that introduces `reservations` must include the constraint and the extension.

## Auth

- Supabase issues the JWT (web signs in via Supabase Auth). NestJS verifies it with the Supabase JWT secret using the `jose` library.
- `AuthGuard` extracts the user from JWT claims. `@CurrentUser()` decorator exposes it to controllers.
- RLS policies in migrations are defense-in-depth. The api is the only client, but RLS catches bugs that would otherwise leak data across users.

## Error handling

All errors flow through a single `AppExceptionFilter` that emits RFC 7807 Problem Details. The `code` field is one of the values exported from `@<org>/contracts/errors`. Adding a new error means: PR to contracts (publish), then PR to api consuming the new code.

## Tests

- Unit: Jest, services with mocked repository interfaces. Fast (< 1s per file).
- Integration: testcontainers Postgres. Real Prisma client. Tests full controller → service → repo flow. Migrations run on startup. Per-test transaction rollback.
- No mocking the DB in integration tests. Reject in review.

Required integration tests:

- Reservation race (two overlapping inserts → exactly one succeeds with 409).
- Reservation hold expiry (cron tick frees a `pending_payment` past `expires_at`).
- Idempotency replay (same `Idempotency-Key` returns cached response, single DB row).
- Forbidden state transitions are rejected with a typed error.

## Local dev

- `pnpm install`
- `pnpm prisma migrate dev`
- `pnpm dev` — starts NestJS on port 3000 with Supabase local stack (`supabase start` separately, or pointed at remote via `.env.local`).

`.env.example` documents every required variable. `.env.local` is gitignored. Real values: ask in the team password manager, do not commit.

## Health

`GET /health` returns `{ status: 'ok', uptime: <seconds>, db: 'up' | 'down' }`. Cloud Run uses this as liveness probe. Do not remove.

## CI

`.github/workflows/ci.yml` calls `<org>/infra/.github/workflows/ci-node.yml@main` with this repo's matrix.

## Pointers for AI agents

- Read `infra/playbook/CONTEXT.md` and `DECISIONS.md` before any non-trivial work.
- When adding a new feature module: copy the structure from an existing module (after sprint 1, `users` is a good template).
- When adding a new external provider: follow ADR-0005. Always start with a stub adapter; real adapter is a separate ADR + PR.
- When in doubt about layer placement: `controllers` only translate HTTP ↔ DTO. `services` hold business rules. `repositories` only do persistence. If you can't decide, ask the architect.
