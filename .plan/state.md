# FlightPlan — Implementation State

Plan: [implementation-plan.md](implementation-plan.md)

Statuses: `not started` · `in progress` · `blocked` · `done`

| Phase | Description | Status | Notes |
|---|---|---|---|
| 0 | Project scaffolding (Vite + Svelte + TS, `base: './'`) | done | `npm run dev` / `build` / `check` all green; dist uses relative asset paths |
| 1 | Astronomy core (ephemeris, sun times, trajectory) | done | 31 Vitest tests green. Validation rests on physical identities, not yet on external Stellarium/USNO values — see log |
| 2 | Catalogs (Messier JSON + planets) | not started | |
| 3 | Horizon & observatories (NINA parser, interpolation, observatory CRUD in localStorage) | not started | |
| 4 | Altitude chart (cylindrical, day/night bands) | not started | |
| 5 | Azimuthal chart (polar down-top view) | not started | |
| 6 | Event times (object + sun events) | not started | |
| 7 | App assembly & UX (pickers, persistence, layout, voronin.cc styling pass) | not started | |
| 8 | Extended: Moon (trajectory, rise/set, phase) | not started | |
| 9 | Build, deploy to S3 & polish | not started | Open: subdomain vs voronin.cc/flightplan path |

## Log

- 2026-07-18 — Plan created; astronomy-engine selected as calculation library; Vite + Svelte 5 + TypeScript chosen as stack. No code yet.
- 2026-07-18 — Spec extended: named "observatories" (location + horizon bundle) with CRUD, persisted to localStorage. Plan Phases 3 and 7 updated accordingly.
- 2026-07-18 — Spec extended: styling must match voronin.cc. Design tokens extracted from `../voronin_cc/static/css/styles.css` into plan (Visual design section).
- 2026-07-18 — Requirement relaxed: no backend, but external resources (fonts/CDN) allowed — fonts now via Google Fonts CDN like the main site. Project will live under voronin.cc; subdomain vs path left as an open question (decide in Phase 9; `base: './'` supports both).
- 2026-07-18 — **Phase 1 done.** `types.ts`, `time.ts`, `ephemeris.ts`, `sun.ts`, `trajectory.ts` under `src/lib/astro/` with 31 Vitest tests.
  - Added `time.ts` (not in the original plan file list): the noon→noon window is needed by both `sun.ts` and `trajectory.ts`, so it did not belong in either.
  - **Refraction convention is a real trap.** `SearchAltitude` (twilight) solves the *geometric* angle, while `SearchRiseSet`/`SearchHourAngle` and the charts use *apparent* (refracted) altitude. The two differ by ~0.6° near the horizon — enough to shift horizon events by minutes. `horizontalAt()` now takes an explicit `AltitudeConvention`; `sunAltitude()` defaults to geometric so it agrees with the twilight times. Phase 6 must keep this straight for the custom-horizon crossings.
  - Catalogue objects reach astronomy-engine through `withEngineBody()`, which installs J2000 coordinates into a shared, overwritable `Body.Star1` slot. Callers must not retain the Body past the callback. J2000 → of-date precession is applied (~0.3° error if skipped; there is a regression test pinning this).
  - **Validation caveat:** tests assert physical identities (Polaris altitude ≈ latitude averaged over a day, culmination altitude = 90 − |lat − dec|, twilight ordering, polar day/night at Svalbard and McMurdo) and cross-check our wrapper against the library's independent search paths. They are *not* yet checked against external Stellarium/USNO reference values as the plan's Phase 1 asks. Spot values for manual comparison — Kyiv 2026-10-15: sunset 15:04 UTC, astronomical dusk 16:54, astronomical dawn 02:33, sunrise 04:21; M13 culminates 75.97° at az 179.8°.
- 2026-07-18 — **Phase 0 done.** Scaffolded Vite 8 + Svelte 5 + TS via `npm create vite` (svelte-ts). `base: './'` set and verified (dist/index.html references `./assets/...`). Design tokens in `src/theme.css`, shared element styles in `src/app.css`, Google Fonts `<link>`s copied from the main site's `head.html`. Prettier configured (no ESLint — `svelte-check` covers correctness; revisit if lint rules are wanted). Vitest installed ready for Phase 1.
- 2026-07-18 — Project renamed SkyProject → **FlightPlan**. Spec file renamed to `flightplan-spec.md`; all references, localStorage key (`flightplan.observatories.v1`) and candidate URLs (flightplan.voronin.cc / voronin.cc/flightplan) updated. Repo directory still `skyproject/`.
