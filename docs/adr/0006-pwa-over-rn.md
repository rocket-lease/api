# ADR 0006 — PWA over React Native

Status: Accepted (sprint 0, supersedes mobile choice in ADR-0001)

## Context

ADR-0001 chose React Native + Expo for the frontend. Before sprint 1 implementation, the team revisited the choice given:

- 7-sprint academic scope; no strict app-store presence requirement v1.
- 6 architects with stronger React/web background than React Native.
- Demo / review needs: a URL is faster to share than a TestFlight invite or APK install.
- Iteration speed: web hot-reload >> Expo dev-client cycle when contracts change.
- Capacitor exists as a wrap path if app-store distribution becomes a requirement later.

## Decision

Build the frontend as a **Progressive Web App** instead of a React Native app.

| Layer | Choice |
|-------|--------|
| Bundler / dev server | Vite |
| Framework | React + TypeScript |
| Styling | Tailwind CSS |
| Component primitives | shadcn/ui (copy-paste, edited per design system) |
| Routing | TanStack Router (or React Router v7 — to confirm sprint 1) |
| Server state | TanStack Query |
| Auth client | `@supabase/supabase-js` (browser SDK + localStorage persistence) |
| PWA manifest + SW | `vite-plugin-pwa` (Workbox under the hood) |
| Push | Web Push API (VAPID) via the service worker |
| Maps | Google Maps JS SDK |
| e2e | Playwright (Chromium, mobile viewport presets) |
| App-store wrap (optional, later) | Capacitor — generates `ios/` + `android/` from the same web build |

The repo is renamed `mobile` → `web` to reflect this decision.

## Rationale

- **One codebase, one deploy.** A static build deploys to Vercel / Netlify / Cloudflare Pages; reviewers open a URL on phone or laptop without installing anything.
- **Familiar stack.** React + Vite + Tailwind matches the architects' existing experience and AI training corpus density.
- **Mobile-first remains the design constraint.** PWAs install to the home screen on Android (full Web Push support) and iOS 16.4+ (limited but functional). The product's core flows (search, reserve, sign, pickup) work fine in a webview-grade UI.
- **Capacitor is a real exit ramp, not a fantasy.** When (if) we need real iOS push or App Store presence, Capacitor wraps the same build with native plugins for camera / geolocation / push. We do not bet on this path v1.
- **Supabase, contracts, error format, concurrency strategy, multi-role model — unchanged.** This ADR is purely a frontend rendering choice.

## Alternatives considered

- **Stay with React Native + Expo.** Rejected. Slower iteration for this team, no compelling product reason to require a native app v1, demo friction higher (Expo Go restrictions, build cycles for production-flag features).
- **Next.js (App Router) instead of Vite.** Rejected. SSR adds infra and complexity for a logged-in app where most pages are behind auth and don't benefit from SSR. Vite ships a smaller, simpler dev surface.
- **Flutter web.** Rejected. Smaller AI corpus, weaker web rendering quality (Skia canvas), and we already have a contracts package designed around TS — Flutter adds a `dart` typing layer for no gain.

## Consequences

- **iOS push notifications** are best-effort (require iOS 16.4+ AND home-screen install). Treat Web Push as a nice-to-have until / unless we wrap with Capacitor.
- **Offline behavior** must be explicitly designed via service worker caching strategies (`NetworkFirst` for API, `CacheFirst` for static, `StaleWhileRevalidate` for images). RN's AsyncStorage-backed offline patterns no longer apply.
- **App Store / Play Store** requires Capacitor wrap (or PWABuilder). Apple Guideline 4.2 will reject a thin webview wrapper that doesn't add native value, so a future App Store push needs at least one native feature (camera, geolocation, push) integrated via Capacitor plugin.
- **Decision `#2`, `#18`, `#20`, `#25`, `#26` updated** in `playbook/DECISIONS.md`. Canonical-rules sections referencing `mobile` (`§2`, `§5`, `§6`, `§8`) renamed and version-bumped; `ci-mobile.yml` renamed to `ci-web.yml`.
- **Hooks reusable across web + future Capacitor wrap.** Business logic in `features/*/hooks/` stays portable; only `lib/` adapters (storage, push, geolocation) would need Capacitor-aware swaps if the wrap happens.
