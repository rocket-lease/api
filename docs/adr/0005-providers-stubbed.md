# ADR 0005 — External providers stubbed v1, behind ports

Status: Accepted (sprint 0)

## Context

Rocket Lease relies on three classes of external services:

- **Payment**: MercadoPago, Modo, billeteras virtuales, transferencias, débito/crédito.
- **Identity verification**: DNI scanning + cross-check (Renaper or equivalent), licencia de conducir validation, foreign-document flow.
- **Push notifications**: Expo Push (already chosen as the transport, but the api should treat it as a pluggable provider).

Real integrations require credentials, billing, sandbox setup, and provider-specific edge cases. None of that fits the 7-sprint window. The PO has confirmed v1 will not perform real integrations — flows must be functionally complete in code with fake providers.

## Decision

Every external provider is wrapped behind an interface (port) in the api domain. Concrete implementations are adapters in the infrastructure layer.

```
api/src/modules/payments/
  services/
    payment.service.ts             # interface (abstract class + DI token)
  infrastructure/
    stub-payment.service.ts        # v1: returns fake success after 200ms
    mercadopago-payment.service.ts # v2: real adapter (later ADR)
  payments.module.ts               # selects which adapter via env var
```

Module wiring:

```ts
{
  provide: PaymentService,
  useClass: process.env.PAYMENT_PROVIDER === 'stub'
    ? StubPaymentService
    : MercadopagoPaymentService,
}
```

Default in all environments v1: `PAYMENT_PROVIDER=stub`.

### Stub behavior conventions

Stubs return realistic shapes but do not mutate external state. They:

- Emit a structured log line (`{ provider: 'stub-payment', op: 'charge', amount: 1500_00, currency: 'ARS' }`) so flows are observable in dev.
- Accept a special test input (e.g. `cardNumber === '4000_0000_0000_0002'`) to simulate failure paths during integration tests.
- Return latency (`await sleep(200)`) so race conditions and timeouts are exercised.

### Affected interfaces

| Port | Stub returns | Replaced by |
|------|--------------|-------------|
| `PaymentService` | `{ status: 'paid', externalId: uuid() }` | MercadoPago / Modo adapter |
| `IdentityVerificationService` | `{ verified: true, validUntil: now + 1y }` (rejects DNI === '00000000') | Renaper / OCR provider |
| `PushNotificationService` | `console.log` + persist to outbox table | Expo Server SDK |
| `StorageService` | local filesystem under `/tmp/uploads` | Supabase Storage |

(Storage may go live earlier than other providers if Supabase Storage is wired in sprint 1; ADR will be revised.)

## Rationale

- Business logic (services in `api/src/modules/<feature>/services/`) never imports a provider SDK directly. It depends on the interface only.
- Swapping providers later means writing one adapter file and changing the module's `useClass`. Zero changes elsewhere.
- Stubs unblock sprint 2 (reservations + payments) without provider procurement.
- Tests use the stub by default; integration tests can swap it out per-suite via `Test.overrideProvider()` from `@nestjs/testing`.

## Anti-patterns to reject in review

- A controller that imports `mercadopagoSdk` directly. Reject.
- A service that branches on `process.env.PAYMENT_PROVIDER`. Reject — that's the module's job.
- A stub that mutates a real external system "just for testing". Reject — it stops being a stub.
- Provider-specific fields leaking into the contracts package. Reject — `contracts` exposes provider-agnostic shapes only.

## Consequences

- Visible TODO: every stub adapter has a top-of-file comment listing the env var to flip and the real adapter file expected to land. `// TODO(adr-0005): replace with MercadopagoPaymentService when integration ADR lands.`
- Coverage on stubs is trivially high; this is acceptable — they exist precisely to be tested as plain code.
- Real providers will need their own ADRs documenting auth, retries, webhooks, idempotency strategy with provider, sandbox vs prod credentials, etc.
