# ADR 0001 — Stack

Status: Superseded in part by ADR-0006 (frontend changed from React Native + Expo to PWA). Other layers (backend, DB, auth, contracts, storage, deploy, CI, package manager) still accepted.

## Context

Rocket Lease is a 7-sprint mobile-first marketplace. 6 architects design, AI agents execute. Type safety end-to-end matters. Contracts must be shared between front and back without codegen overhead. Free-tier infra preferred while domain stabilizes.

## Decision

| Layer | Choice |
|-------|--------|
| Mobile | React Native + Expo + NativeWind + react-native-reusables |
| Backend | NestJS (Node 20+, TypeScript) |
| DB | Postgres on Supabase + Prisma |
| Auth | Supabase Auth (JWT verified by NestJS via `jose`) |
| Contracts | Zod schemas + inferred TS types + thin typed API client, consumed as source via `link:` (see ADR-0007) |
| Storage | Supabase Storage (`vehicle-photos` public-read, `id-documents` private/signed) |
| Maps | Google Maps + `react-native-maps` |
| Push | Expo Push Notifications |
| Deploy (api) | Containerized image to GHCR; runtime target GCP Cloud Run (likely, not committed) |
| CI | GitHub Actions, one workflow per repo (`.github/workflows/`) |
| Package manager | pnpm |

## Rationale

- TypeScript both sides → contracts package = pure TS, no codegen pipeline.
- NestJS gives opinionated layered structure (controllers/services/repos) that AI agents follow consistently.
- Supabase consolidates Postgres + Auth + Storage under one vendor; free tier covers 7-sprint scope.
- React Native + Expo: largest AI training corpus, fastest mobile iteration, OTA updates via Expo.

## Alternatives considered

- **tRPC instead of contracts package**: rejected. Couples frontend tightly to backend internals; user explicitly designed contracts as separate, versioned package.
- **Flutter / native**: rejected. Smaller AI corpus, codegen-driven contracts, slower iteration in 7-sprint window.
- **Custom JWT auth**: rejected. Security risk with AI authoring auth code; Supabase Auth is free at the project's scale.
- **Clerk + Supabase**: rejected. Adds second vendor and a JWT-template bridge; no compelling win for this project's scale.

## Consequences

- **Lock-in**: Supabase across DB/auth/storage. Mitigated by Prisma (DB swap-able to plain Postgres) and `AuthService` interface in NestJS (provider swap-able).
- **Sibling clone convention**: contracts is consumed as source via `link:../contracts`; every developer needs the three repos cloned in the same parent directory. A preinstall script enforces this and points at the README.
- **NestJS bundle size**: not optimized for serverless. Sticking with always-on container deploy (Cloud Run scales to zero but stays warm during traffic).
