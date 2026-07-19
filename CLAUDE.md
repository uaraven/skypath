# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**FlightPlan** — a static single-page web app (no backend) for planning astronomical observations: pick a target (Messier object or planet), a date, and an observatory (location + custom horizon), and see the target's sky trajectory plus rise/set/culmination and twilight times. Deploys as plain files to S3 as part of the voronin.cc site. The directory is named `skyproject/` for historical reasons; the project name is FlightPlan.

## Current state: phases 0–3 done (scaffolding, astronomy core, catalogs, horizon & observatories)

Planning documents live in `.plan/`:

- `.plan/flightplan-spec.md` — requirements (source of truth for functionality)
- `.plan/implementation-plan.md` — tech decisions, architecture, phases 0–9 with "done when" criteria
- `.plan/state.md` — per-phase status table and decision log. **Keep this updated**: mark phase status changes and append dated log entries for any decision or requirement change.
- `altitude.png` / `azimutal.png` — reference renderings the two chart types must visually match

## Commands

- `npm run dev` — Vite dev server
- `npm run build` / `npm run preview`
- `npm test` (`test:watch`) — Vitest; `npm run check` — svelte-check + tsc
  - Three projects: `test:unit` (Node, `src/lib/**`), `test:components` (jsdom + Testing Library, `src/components/**`) and `test:visual` (real Chromium via Playwright, `src/visual/**`). Put a test next to what it covers; the project is chosen by directory, not by filename.
  - Visual tests are for what jsdom cannot answer — computed layout, applied fonts, real visibility, chart geometry. `npm run test:visual:open` runs them headed; screenshots land in `screenshots/` (gitignored). `src/visual/tester.html` must keep the same font `<link>`s as `index.html`, or the browser falls back to Helvetica while `font-family` still reports the declared face.
- `npm run format` — Prettier (no ESLint)
- `npm run catalog:build` — regenerate `src/lib/catalog/data/*.json` from OpenNGC

## Code layout

- `src/lib/astro/` — ephemeris, sun/twilight, trajectory sampling. Knows nothing about catalogs.
  - Watch the refraction convention: twilight is _geometric_ altitude, rise/set and the charts are _apparent_. See `AltitudeConvention` in `ephemeris.ts`.
  - Deep-sky objects reach astronomy-engine via `withEngineBody()`, which reuses one shared `Body.Star1` slot — never retain the `Body` past the callback.
- `src/lib/catalog/` — targets the user can pick. `index.ts` is the public API (`searchObjects`, `objectById`, `objectByDesignation`, `allObjects`).
  - An object belongs to **many catalogs and has many names** — `CatalogObject.designations` / `.names`. Don't collapse either to a single value.
  - To add a catalog: register it in `catalogs.ts`, generate JSON into `data/`, import it in `dso.ts`. Entries sharing a designation merge into one object.
  - Data is generated from OpenNGC (**CC-BY-SA-4.0 — attribution required**, exposed as `catalogSources`). Never hand-edit `data/*.json`.
- `src/lib/horizon/` — NINA file parsing and `Horizon.altitudeAt(azimuth)`. The azimuth axis is circular: the segment between the last and first point wraps through north, and getting that wrong silently reports a clear horizon.
- `src/lib/observatory/` — named location + horizon bundles in localStorage. Invariants: the list is never empty and one is always selected. The horizon is stored as **raw text**, parsed on the render path by the memoizing `horizonFromText`.
- `src/components/` — Svelte UI. `ObservatoryManager` takes an optional `store` prop (defaults to the app-wide singleton) so tests can inject one over `MemoryStorage`.

## Decided stack (do not re-litigate without the user)

- Vite + Svelte 5 + TypeScript, `base: './'` (must keep working from both a subdomain and a path prefix — final URL is an open question)
- `astronomy-engine` (npm) for all ephemeris math — do not hand-roll coordinate transforms or rise/set searches
- Hand-rolled SVG for both charts (no charting library)
- Vitest for unit tests; astronomy results validated against Stellarium/USNO reference values
- `localStorage` for all persistence (single versioned key `flightplan.observatories.v1`); no backend ever

## Styling

Must match the main site, whose sources are in the sibling repo `../voronin_cc` (Eleventy site; CSS at `static/css/styles.css`, fonts in `_includes/head.html`). Design tokens are already extracted into the implementation plan's "Visual design" section — use those as CSS custom properties in `src/theme.css` rather than re-deriving from the site. Fonts come from Google Fonts CDN (Red Hat Display, Fira Code), same `<link>` tags as the main site. External CDN resources are allowed; only a backend is excluded.

## Domain notes

- Horizon files are NINA-compatible: plain text, one `azimuth altitude` pair per line (azimuth 0–359°); interpolation must wrap around 360°→0°.
- "Above horizon" events compare object altitude to the _user horizon_ altitude at the object's current azimuth — distinct from the "above 0°" events; both are reported.
- Charts are centered on local midnight (time axis ≈ noon→noon); handle circumpolar / never-rises objects and polar day/night explicitly.
- Times display in the browser's local timezone (known limitation, noted in plan).
