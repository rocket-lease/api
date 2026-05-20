# ADR 0007 — Contracts consumed as TypeScript source (no npm publish)

Status: Accepted (sprint 2). Supersedes the consumption + versioning model of ADR-0003. The structure and intent of `contracts` (Zod = source of truth, single shapes for api + web) stays unchanged.

## Context

The original model (ADR-0003) treated `@rocket-lease/contracts` as a published npm package. In practice, with 6 developers doing full-stack tickets end-to-end across `api`, `web` and `contracts`, every schema tweak required a lockstep ritual:

1. PR to `contracts` → review → merge → manual `pnpm version` → release → publish to npm.
2. PR to `api` bumping the new version.
3. PR to `web` bumping the new version.

Until step 1 was finished, CI in `api` and `web` was blocked — they referenced a version that did not exist on the registry. Local iteration relied on `pnpm link --global`, which works but cannot be committed; the AGENTS.md explicitly forbade committing linked or `file:` deps.

The pain compounded inside Sprint 2 because the sprint introduces four new schemas at once (Reservation, Payment, Voucher, ReservationRuleSet). Twelve cross-repo PRs to ship 12 stories was unacceptable friction.

Monorepo was considered (workspaces + `workspace:*`) and rejected by the team for organizational reasons. Git submodules / commit-SHA dependencies were rejected because they still require a push-and-fetch cycle per change.

## Decision

`contracts` stops being a published runtime artifact. It becomes a TypeScript-source dependency consumed via `pnpm`'s `link:` protocol + tsconfig path mapping. The published-npm flow is preserved as a build target for hypothetical external consumers, but is no longer in the day-to-day developer loop.

### 1. `contracts` package shape

- No `dist/`. No `tsup` build step. The package ships `.ts` source.
- `package.json` `exports[".]` points at `./src/index.ts`.
- The build script is removed from the default scripts; type-check and tests stay.
- The package can still be bundled to `dist/` on demand (e.g. for an npm publish in the future), but the standard developer flow does not build it.

### 2. Consumer dependency

In `api/package.json` and `web/package.json`:

```jsonc
"dependencies": {
  "@rocket-lease/contracts": "link:../contracts"
}
```

`pnpm install` creates `node_modules/@rocket-lease/contracts` as a symlink to `../contracts`. The repos are expected to be cloned side-by-side:

```
~/<workdir>/
├── api/
├── contracts/
└── web/
```

### 3. Type / module resolution

Both consumers declare an explicit path mapping in `tsconfig.json`:

```jsonc
"paths": {
  "@rocket-lease/contracts": ["../contracts/src/index.ts"],
  "@rocket-lease/contracts/*": ["../contracts/src/*"]
}
```

And include the sibling source in `include` so that `tsc --watch` / nest watch picks up changes:

```jsonc
"include": ["src", "../contracts/src"]
```

Vite uses the `vite-tsconfig-paths` plugin to honor the same mapping. Jest uses the `moduleNameMapper` entries documented in each repo. Webpack (via `nest build --webpack`) honors the tsconfig paths through `tsconfig-paths-webpack-plugin`; the import is resolved at build time and inlined in the bundle.

### 4. Local dev experience

Devs run `make run` in each repo. Both Makefile targets gate on a sibling check: if `../contracts` is missing, the command exits with a clear error and the URL to clone it. Editing any `.ts` in `contracts/src/` triggers HMR in Vite and `nest start --watch` rebuild in api. No `pnpm build`, no version bump, no publish.

### 5. Production build = bundled artifact

The `link:` is a dev-time concern only. Both prod builds inline contracts source into their output:

- **Web** (`vite build`): Vite walks the import graph, compiles + bundles contracts source into the JS chunks of `dist/`. Runtime has no awareness of `@rocket-lease/contracts`.
- **API** (`nest build --webpack`): produces a single bundled `dist/main.js`. Webpack inlines contracts source via tsconfig paths. The runtime Docker image does not contain `@rocket-lease/contracts` in `node_modules`.

### 6. Cross-repo orchestration in CI

Each consumer's CI workflow checks out the consumer and `contracts` as sibling directories before `pnpm install`. Two `actions/checkout` steps inline in the workflow are enough — no shared composite action.

The contracts ref resolves as follows:

1. Try to checkout `contracts` at the **same branch name** as the consumer (`github.head_ref || github.ref_name`).
2. If that branch does not exist in contracts, fall back to the consumer PR's **base ref** (`dev` or `main`).

This is what makes the flow work without ceremony:

- A US that does not touch contracts → the matching branch does not exist in contracts → fallback to base. Correct compile target.
- A US that does touch contracts → the dev creates the same branch in all three repos → CI uses the matching branch. Correct compile target.

There is no strict mode and no rule that requires pushing empty branches. The dev only creates a branch in contracts when they actually have something to put there.

### 7. Deploy

- **API → Cloud Run**: `docker build` runs from CI with build context set to the parent directory containing both `api/` and `contracts/`. The Dockerfile uses multi-stage with the build stage copying both repos in, running `pnpm install` (resolves the link), `pnpm build` (webpack-bundled), then a runtime stage that copies only `dist/` and production `node_modules`.
- **Web → Vercel**: Vercel keeps building previews on PRs via its own GitHub integration. `vercel.json` ships `installCommand` and `buildCommand` overrides that clone contracts as a sibling before `pnpm install`. Alternatively the team can move to "build in GitHub Actions + `vercel deploy --prebuilt`" if Vercel's environment becomes a friction point.

## Consequences

### Positive

- One PR per ticket. The full-stack dev pattern (schema → server logic → UI) lives in a single coordinated push across the three repos.
- Zero `pnpm version`, zero releases, zero registry round-trips during day-to-day development.
- LSP shows contract changes instantly in both consumers.
- Bundle outputs are self-contained, so production deploys are unchanged in spirit.

### Negative / risks

- A dev who modifies a contracts schema in their feature branch but **forgets to push the contracts branch** will see api/web CI fall back to base of contracts → compile against the old schema → potentially green CI on inconsistent code. The PR review catches this almost always (the dev sees the import locally), but it is the one real failure mode.
- The "publish to npm" path is no longer exercised; if the team ever needs an external consumer of contracts, the release pipeline will need a one-time revival.
- Developer onboarding requires cloning all three repos into the same parent directory. This is enforced by a preinstall check.

## Alternatives considered

- **Monorepo (`pnpm workspaces`)** — rejected for organizational reasons (separate repos for issues, branches, PRs).
- **Commit-SHA git deps** (`github:rocket-lease/contracts#sha`) — rejected: still requires push + SHA bump per change.
- **yalc** — works locally; still requires a coordinated CI strategy and a manual `yalc publish --push`.
- **tRPC** — would eliminate `contracts` entirely. Rejected for sprint 2 because it requires migrating NestJS endpoint patterns.

## Tests / verification

| Surface | Check |
|---|---|
| Local dev (host) | `make run` in api and web start cleanly with `../contracts` cloned; deleting `../contracts` produces the documented error message |
| Local dev (docker) | `make run-local` (api) builds and runs with contracts bind-mounted; hot reload across the boundary works |
| CI (api) | Dual checkout succeeds, `pnpm install` succeeds, tests pass, `pnpm build` produces a bundled `dist/main.js` |
| CI (web) | Dual checkout succeeds, `pnpm install` succeeds, `pnpm build` produces `dist/` with contracts inlined |
| Deploy (api) | `docker build` from parent context produces an image whose runtime layer has no `@rocket-lease/contracts` in `node_modules` and starts |
| Deploy (web) | Vercel preview build green; production deploy succeeds |
