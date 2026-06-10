# ADR 0008 — Weighted demand signals for dynamic pricing

Status: Accepted (sprint 5, US-51 follow-up). Refines the demand model introduced with `DEMAND_ZONE_FACTOR` (see `api/src/application/pricing/config/dynamic-pricing.config.ts`).

## Context

US-51 introduced dynamic pricing by hex H3 zone. The first implementation modeled demand with two signals:

- `search`: each viewport search logged the **centroid** of the bounding box (or the explicit "Cerca de mí" center) as one row in `search_logs`.
- `reservation`: confirmed reservations counted with a flat `reservationWeight = 3` multiplier on top of search count.

This shipped enough to demo, but two product gaps surfaced once we used the admin map with real traffic patterns:

1. **A viewport search "all of CABA" logs a single hex (the city centroid).** A conductor zooming out to see the whole city does *not* mean they want a car at Plaza de Mayo. The intent signal coming out of a wide search is genuinely weak — but we were treating it with the same weight as a confirmed reservation divided by 3, which over-counted it.
2. **No signal at all when a conductor opens a specific vehicle.** Clicking a particular `Toyota Corolla` in Palermo and reading its full detail is a *strong* indicator of interest in that hex (Palermo), but US-51 captured zero data about it. We were leaving the strongest cheap signal in the funnel on the table.

Production P2P marketplaces with similar geographies (Turo for cars, Airbnb for stays, Uber Marketplace for rides) all solve this with a layered demand model: multiple signals along the intent funnel, each weighted by its predictive value for conversion.

## Decision

We model demand as the weighted sum of four signals along the conductor funnel. Every relevant event writes one row in `search_logs` tagged with a `signal` enum.

| Signal           | Trigger                                              | Weight | Debounce         |
| ---------------- | ---------------------------------------------------- | ------ | ---------------- |
| `search`         | Viewport / "Cerca de mí" search (logs centroid hex)  |     1× | 30 s per session |
| `vehicleView`    | Detalle de vehículo se monta (logs vehicle's hex)    |     5× | 5 min per (session, vehicle) |
| `quote`          | Conductor cotiza un vehículo (logs vehicle's hex via `price_quotes`) |    20× | n/a (TTL 5 min) |
| `reservation`    | Reserva confirmada (logs vehicle's hex via `reservations`) |    50× | n/a (terminal state) |

Aggregate demand per hex over a sliding 7-day window:

```
demand(hex) = Σ signal_count(hex, s) × weight(s)
            for s in {search, vehicleView, quote, reservation}
```

The same weights drive both the admin map (`AdminPricingService.aggregateZones`) and the runtime dynamic pricing factor (`DemandZoneFactor.compute`), so the multiplier surfaced to a conductor at quote time and the heatmap shown to the admin always agree.

### Storage

Each signal lives in its canonical table; nothing is mirrored:

- `search` / `vehicleView` → `search_logs` (the `signal TEXT` column distinguishes them).
- `quote` → `price_quotes` (counted by hex via `PriceQuoteRepository.countByHexSince`).
- `reservation` → `reservations` (counted by hex via `PricingStatsRepository.countConfirmedInHexSince`).

The aggregator joins the four counts at read time. This keeps the conversion record canonical (PriceQuote / Reservation) instead of duplicating it into `search_logs`. Both the runtime factor (`DemandZoneFactor`) and the admin map (`AdminPricingService`) gather the same four counts and weight them through the single shared helper `computeWeightedDemand` (`application/pricing/demand-weight.ts`), so the multiplier charged to the conductor and the heatmap shown to the admin cannot drift apart.

For zone-demand counting, `quote` and `reservation` carry real weight only because they are read from their own tables — `search_logs` only ever holds `search` and `vehicleView` rows.

### Weight rationale

Weights chosen with two constraints:

1. **Monotone with intent.** Each step deeper in the funnel must weigh strictly more than the step before.
2. **Conversion-anchored ratios.** The reservation : view ratio (50:5 = 10:1) approximately matches observed view-to-booking conversion in P2P car rental marketplaces, so each view "counts" as the fractional reservation it predicts. Same logic for view : search (5:1).

Weights live in `dynamic-pricing.config.ts` as constants — they are NOT in the database. The constants are calibration parameters of the pricing engine, not user data.

### Debounce policy

Debounce windows are per (sessionId, signal) and where relevant per (sessionId, signal, h3Cell):

- `search` at 30 s prevents inflating the table during pan/zoom flurries with the same viewport.
- `vehicleView` at 5 min absorbs back-button refreshes of the same detail page; a conductor genuinely re-engaging with the same vehicle after 5 minutes does count again.
- `quote` and `reservation` have no application-level debounce because they already require explicit user action with a downstream side effect (PriceQuote creation / Reservation creation).

## Consequences

### Positive

- **Real demand surfaces.** The admin map now lights up where conductors actually look at vehicles, not only where their viewport centroid landed.
- **Pricing engine and admin map agree.** Both consume `DEMAND_ZONE_FACTOR.signalWeights`. Tuning weights moves both surfaces in lockstep.
- **No PII leak.** The whitelist on `SearchLogFilters` (intro'd in the US-51 security fix) is extended with `vehicleId` only. Nothing user-identifying joins the log payload.
- **Backward compatible.** Existing rows default to `signal='search'`; the aggregator and factor degrade gracefully if a signal type is missing.

### Negative / accepted

- **More writes per session.** A conductor browsing 5 vehicles now writes 6 rows (1 search + 5 view) instead of 1. The cleanup cron at 14 days retention handles the inflation; we sized the index `(signal, created_at DESC)` to match the aggregator's GROUP BY.
- **Weights are not learned, they are configured.** A real production team would A/B test or fit weights against booking outcomes. For our scale, hand-picked weights anchored to industry benchmarks are good enough and explicit (defensible in the demo).
- **`vehicleView` is logged anonymously when no auth header is present.** This is intentional: the marketplace search experience is public, and demand is demand regardless of authentication. The endpoint is rate-limited only by the per-(session, vehicle) debounce.

## Future work

- Replace the centroid-only `search` log with a "viewport ∩ supply" log: emit one row per hex that contains at least one published vehicle inside the viewport. This would turn `search` from "I was looking around here" into "I was looking at vehicles here" without exploding the table.
- Surface the weighted demand breakdown in the admin map hex detail (today the user sees `demandCount` aggregated; would be more legible to show per-signal contribution).
- Calibrate weights against actual conversion data once we have ≥ 30 days of post-launch funnel.

## References

- `api/src/application/pricing/config/dynamic-pricing.config.ts` — single source of truth for weights.
- `api/src/application/pricing/factors/demand-zone.factor.ts` — runtime application in pricing engine.
- `api/src/application/admin/admin-pricing.service.ts` — application in the admin map aggregator.
- `api/src/application/search-log.service.ts` — debounce policy + write path.
- Migration `prisma/migrations/20260606203252_search_log_signal/migration.sql` — schema evolution.
