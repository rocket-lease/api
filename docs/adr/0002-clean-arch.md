# ADR 0002 — Pragmatic clean architecture in api

Status: Accepted (sprint 0)

## Context

Backend handles a complex domain (reservations, payments, contracts, reputation, identity verification). Business logic must be testable without DB or HTTP. AI agents should place new code in the right layer without ambiguity.

Full hexagonal (Uncle Bob, separate `domain/`/`application/`/`infrastructure/` top-level folders) is too much ceremony for a 7-sprint window — AI agents tend to misplace files when layer boundaries are abstract. Plain NestJS (controllers + services, no repository interface) couples business logic to Prisma → untestable without a real DB.

## Decision

Per-feature module layout under `api/src/modules/<feature>/`:

```
modules/<feature>/
  controllers/        # HTTP entry points, DTOs, validation via nestjs-zod
  services/           # business logic, orchestration, transactions
  repositories/
    <feature>.repository.ts          # interface (token + abstract class)
    prisma-<feature>.repository.ts   # Prisma implementation
  entities/           # plain classes, no @prisma/@ORM decorators
  dto/                # request + response shapes (Zod schemas from contracts)
  events/             # domain events emitted by services
  <feature>.module.ts # NestJS module wiring DI
  <feature>.module.spec.ts
```

## Rules (enforced by review + lint where possible)

- Controllers call services only. Never repositories or Prisma directly.
- Services depend on the **repository interface**, injected via NestJS DI token. No `PrismaService` import in services.
- Entities are plain TS classes. Prisma model types live in repositories only and are mapped to entities at the repository boundary.
- Cross-module access only through the public service contract, never through repositories.
- External providers (payment, identity, push, storage) wrapped behind interfaces in `services/<provider>.service.ts`. Concrete adapter in `infrastructure/<provider>.adapter.ts`.

## Why not full hexagonal

For 7 sprints with AI execution: the cost of misplaced files (entities under `infrastructure/`, use cases that import Prisma directly) exceeds the swap-ability win. Pragmatic clean keeps the same essence — repository interfaces + DI — at half the boilerplate.

## Consequences

- Slight repetition: every module has its own controllers/services/repositories folder. Accepted for predictability.
- Repository interfaces add 1 file per module. Tests gain mockability for free.
- Migration to full hexagonal later is straightforward: rename `services/` → `application/use-cases/`, `repositories/` → split interface to `domain/`, impl to `infrastructure/`.
