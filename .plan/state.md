# FlightPlan — Implementation State

Plan: [implementation-plan.md](implementation-plan.md)

Statuses: `not started` · `in progress` · `blocked` · `done`

| Phase | Description | Status | Notes |
|---|---|---|---|
| 0 | Project scaffolding (Vite + Svelte + TS, `base: './'`) | done | `npm run dev` / `build` / `check` all green; dist uses relative asset paths |
| 1 | Astronomy core (ephemeris, sun times, trajectory) | not started | |
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
- 2026-07-18 — **Phase 0 done.** Scaffolded Vite 8 + Svelte 5 + TS via `npm create vite` (svelte-ts). `base: './'` set and verified (dist/index.html references `./assets/...`). Design tokens in `src/theme.css`, shared element styles in `src/app.css`, Google Fonts `<link>`s copied from the main site's `head.html`. Prettier configured (no ESLint — `svelte-check` covers correctness; revisit if lint rules are wanted). Vitest installed ready for Phase 1.
- 2026-07-18 — Project renamed SkyProject → **FlightPlan**. Spec file renamed to `flightplan-spec.md`; all references, localStorage key (`flightplan.observatories.v1`) and candidate URLs (flightplan.voronin.cc / voronin.cc/flightplan) updated. Repo directory still `skyproject/`.
