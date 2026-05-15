# ADR 0004 — Reservation concurrency strategy

Status: Accepted (sprint 0, deepens at sprint 2 implementation)

## Context

The reservation flow (sprint 2) faces an unavoidable race: two conductors can submit reservation requests for the same vehicle on overlapping dates within milliseconds. Application-level checks (`SELECT ... if available, INSERT`) cannot guarantee correctness under concurrent traffic.

Additional concerns:

- Checkout takes time (user picks payment method, enters card data). Slot must be held during this window or another user might race in.
- Mobile retries on flaky network must not double-create reservations or double-charge.

## Decision

Three layered mechanisms:

### 1. Postgres `EXCLUDE` constraint (atomic floor)

Migration adds `btree_gist` extension and an exclusion constraint:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'rejected', 'expired'));
```

The DB rejects any insert/update that would create an overlap with an active reservation on the same vehicle. The application catches the resulting Postgres error (`23P01` exclusion_violation) and returns:

```json
{ "code": "VEHICLE_NOT_AVAILABLE", "status": 409 }
```

This is the floor: even with bugs in application logic, double-booking cannot happen.

### 2. 10-minute hold during checkout

When the conductor confirms reservation (before paying), the api creates the reservation in `pending_payment` status with an `expires_at = now() + 10 min` column. The slot is held (counts in the EXCLUDE constraint) during this window.

A NestJS scheduled task (`@Cron('* * * * *')`, every minute) flips expired holds:

```sql
UPDATE reservations SET status = 'expired'
WHERE status = 'pending_payment' AND expires_at <= now();
```

Once flipped to `expired`, the constraint excludes it, freeing the slot.

On payment success, the service flips `pending_payment` → `confirmed`. On payment failure or timeout, the cron handles cleanup naturally.

### 3. Idempotency keys on reservation + payment endpoints

Mobile generates a UUID v7 per attempt and sends it in `Idempotency-Key` header. The api stores `(key, request_hash, response, created_at)` in an `idempotency_keys` table for 24 hours. Duplicate keys return the cached response without re-creating the reservation or re-charging.

Endpoints requiring idempotency:
- `POST /reservations`
- `POST /payments`
- `POST /reservations/:id/cancel`

## State machine

See `api/docs/CONTEXT.md` for the canonical diagram. Transitions allowed only via the `ReservationsService` — direct status updates from controllers or other modules are forbidden.

## Tests required

In `api` integration tests (using testcontainers Postgres):

1. **Race**: two `Promise.all` inserts for overlapping dates. Exactly one resolves with success, the other rejects with `VEHICLE_NOT_AVAILABLE`.
2. **Hold expiry**: insert `pending_payment` with `expires_at` in the past, run cron tick, verify slot is reusable.
3. **Idempotency replay**: same `Idempotency-Key` twice, verify only one DB row exists, both responses identical.
4. **State transition guards**: try forbidden transitions (e.g. `expired` → `confirmed`), verify rejection.

## Alternatives considered

- **Application-level `SELECT FOR UPDATE`**: works, but requires careful transaction boundaries; harder to reason about with NestJS connection pool; adds serialization at row level.
- **Redis distributed lock**: extra infra dependency; locks can be lost if Redis is unavailable; incorrect under network partitions.
- **Optimistic locking with version column**: detects conflicts late; requires retry logic in client; bad UX for the losing user.

The DB-level EXCLUDE constraint is the cleanest, hardest-to-misuse primitive available. It costs one migration and one Postgres extension.

## Consequences

- Every reservations-touching service must use the `tstzrange` types correctly. Prisma's `Unsupported("tstzrange")` requires raw queries or a custom type — the repository layer handles this; services see plain `{ startAt: Date, endAt: Date }`.
- `expires_at` cron is a critical path; CI integration test verifies it runs.
- The `idempotency_keys` table needs cleanup (24h TTL via cron, separate from reservation expiry).
