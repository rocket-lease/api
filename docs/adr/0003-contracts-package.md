# ADR 0003 — Contracts package (Zod + types + thin client)

Status: Accepted (sprint 0)

## Context

API boundary must stay consistent between `api` (NestJS server) and `mobile` (RN client). Both are TypeScript. Three competing pressures:

1. Single source of truth for request/response shapes (no duplicated types).
2. Runtime validation on both sides (server validates input, mobile validates forms).
3. Mobile dev should write `apiClient.reservations.create(input)` and get type-safe params + return — no URL strings, no manual fetch wrappers.

## Decision

Single npm package `@<org>/contracts` published to GitHub Packages.

Contents:

```
contracts/
  src/
    schemas/
      <resource>.schema.ts            # Zod schemas (one per resource: User, Vehicle, Reservation, ...)
    types/
      <resource>.types.ts             # export type X = z.infer<typeof XSchema>
    client/
      api-client.ts                   # createApiClient(baseUrl, getToken): typed fetch wrapper
      endpoints.ts                    # path templates as functions: reservations.create = (id) => `/reservations/${id}`
    errors/
      error-codes.ts                  # union enum of RFC 7807 `code` values
    index.ts                          # barrel export
  package.json
  tsconfig.json                       # declaration: true, declarationMap: true
```

Both `api` and `mobile` install via:

```jsonc
"dependencies": {
  "@<org>/contracts": "^1.x.x"
}
```

`api` uses schemas via `nestjs-zod` to validate request bodies and DTOs. `mobile` uses schemas via `zodResolver` for React Hook Form + types for the `apiClient`.

## Versioning

Semantic Versioning, automated:

- **Patch**: bug fix in shared types, no API behavior change.
- **Minor**: additive (new optional field, new endpoint). Backwards-compatible for both ends.
- **Major**: removal, rename, or shape change. Breaking; both `api` and `mobile` must update in lockstep.

CI on `main` of contracts: bumps version, builds `dist/`, publishes to GitHub Packages, tags release.

## Consumption order (architects: enforce in PR sequencing)

1. PR to `contracts` → review → merge → publish `1.x.y`.
2. PR to `api` updating `@<org>/contracts` to `1.x.y` and implementing the changes.
3. PR to `mobile` updating `@<org>/contracts` to `1.x.y` and consuming the changes.

Out-of-order PRs cause build failures (good — surfaces drift). CI in `api` + `mobile` runs against the pinned contracts version, not `latest`.

## Rationale

- Zod as source means types AND runtime validation come from one place. No `class-validator` parallel set.
- Thin client (typed wrapper around `fetch`) saves mobile from URL strings and method enum drift. NestJS does not consume the client (it serves).
- GitHub Packages auth is free for org members; PAT in `~/.npmrc` for local installs, `GITHUB_TOKEN` in CI.

## Alternatives considered

- **Plain TS types only (no Zod)**: rejected. Loses runtime validation parity; `api` would need a separate validator (class-validator), which would diverge.
- **OpenAPI YAML + codegen**: rejected. Heavier pipeline; both sides being TS makes codegen redundant; OpenAPI does not natively express discriminated unions or refinements as cleanly as Zod.
- **tRPC**: rejected. Skips the contracts package entirely but couples mobile to backend internals; harder to swap server later; harder to expose to non-RN clients.

## Consequences

- Every architect needs a GitHub PAT with `read:packages` configured locally (onboarding doc).
- A breaking change requires three coordinated PRs; cost is real but predictable.
- The package is small (a few hundred KB max). Bundle size in `mobile` impact is negligible.
