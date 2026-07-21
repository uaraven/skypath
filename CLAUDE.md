# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SkyPath** — a static single-page web app (no backend) for planning astronomical observations: pick a target (Messier object or planet), a date, and an observatory (location + custom horizon), and see the target's sky trajectory plus rise/set/culmination and twilight times. Deploys as plain files to S3 as part of the voronin.cc site. The directory is named `skyproject/` for historical reasons; the project name is SkyPath.

## Current state: phases 0–7.5 done — the app is functionally complete

Both charts (altitude + all-sky/azimuthal), event times, the linked time slider, observatory CRUD with JSON export/import, and a Help dialog are all in. Remaining: phase 8 (Moon as a *target* — trajectory/rise/set/phase) and phase 9 (build & deploy to S3). See `.plan/state.md` for the authoritative per-phase table.

Planning documents live in `.plan/`:

- `.plan/skypath-spec.md` — requirements (source of truth for functionality)
- `.plan/ui-mocks.md` — the layout the app must have (source of truth for UI structure)
- `.plan/implementation-plan.md` — tech decisions, architecture, phases 0–9 with "done when" criteria
- `.plan/state.md` — per-phase status table and decision log. **Keep this updated**: mark phase status changes and append dated log entries for any decision or requirement change.
- `altitude.png` / `azimutal.png` — reference renderings the two chart types must visually match

## Commands

- `npm run dev` — Vite dev server
- `npm run build` / `npm run preview`
- `npm test` (`test:watch`) — Vitest; `npm run check` — svelte-check + tsc
  - Three projects: `test:unit` (Node, `src/lib/**`), `test:components` (jsdom + Testing Library, `src/components/**`) and `test:visual` (real Chromium via Playwright, `src/visual/**`). Put a test next to what it covers; the project is chosen by directory, not by filename.
  - Visual tests are for what jsdom cannot answer — computed layout, applied fonts, real visibility, chart geometry. `npm run test:visual:open` runs them headed; screenshots land in `screenshots/` (gitignored). `src/visual/tester.html` must keep the same font `<link>`s as `index.html`, or the browser falls back to Helvetica while `font-family` still reports the declared face. The Playwright instance also pins `context.timezoneId` — `env: { TZ }` only reaches the Node process, and since the charts are built from _local_ noon, the host timezone would otherwise draw a different night than the assertions compute.
- `npm run format` — Prettier (no ESLint)
- `npm run catalog:build` — regenerate `src/lib/catalog/data/*.json` from OpenNGC (Messier/NGC/IC) and VizieR (Sharpless 2, LDN)

## Code layout

- `src/lib/astro/` — ephemeris, sun/twilight, trajectory sampling. Knows nothing about catalogs.
  - Watch the refraction convention: twilight is _geometric_ altitude, rise/set and the charts are _apparent_. See `AltitudeConvention` in `ephemeris.ts`.
  - Deep-sky objects reach astronomy-engine via `withEngineBody()`, which reuses one shared `Body.Star1` slot — never retain the `Body` past the callback.
- `src/lib/catalog/` — targets the user can pick. `index.ts` is the public API (`searchObjects`, `objectById`, `objectByDesignation`, `allObjects`).
  - An object belongs to **many catalogs and has many names** — `CatalogObject.designations` / `.names`. Don't collapse either to a single value.
  - To add a catalog: register it in `catalogs.ts`, generate JSON into `data/`, import it in `dso.ts`. Entries sharing a designation merge into one object.
  - Bundled: Messier, NGC, IC (from OpenNGC) and Sharpless 2, LDN (from VizieR) — ~15 000 objects. Data is generated, never hand-edit `data/*.json`. OpenNGC is **CC-BY-SA-4.0 — attribution required** (all sources exposed as `catalogSources`).
  - Sharpless/LDN **do not cross-match** to NGC/IC: no shared designations exist in either source, so NGC 7000 and Sh2-117 are two entries, and neither VizieR catalog carries common names. See `data/README.md`.
- `src/lib/horizon/` — NINA file parsing and `Horizon.altitudeAt(azimuth)`. The azimuth axis is circular: the segment between the last and first point wraps through north, and getting that wrong silently reports a clear horizon.
- `src/lib/observatory/` — named location + horizon bundles in localStorage. Invariants: the list is never empty and one is always selected. The horizon is stored as **raw text**, parsed on the render path by the memoizing `horizonFromText`.
  - `transfer.ts` moves observatories between machines as a tagged JSON file (`serializeObservatories` / `parseObservatoryImport`). `selectedId` is deliberately **not** exported — highlight is a property of the browser, not the collection — and the horizon travels as its raw NINA text, so a round trip is byte-for-byte.
- `src/lib/charts/` — chart geometry and data, no Svelte. Altitude chart: `scales.ts` (projection into an SVG `PlotArea`), `sky-bands.ts` (twilight shading), `model.ts` (`altitudeChartModel` — everything a chart draws, computed once). All-sky/azimuthal chart: `polar.ts` (the **down-top** projection — the E/W handedness convention lives here) + `all-sky.ts` (its model). `marker.ts` is the shared time-slider marker both charts flag the current moment with; `moon-glyph.ts` the Moon phase glyph.
  - The **chart components live in `src/components/`**, not here, so Vitest's Node `unit` project doesn't collect them. Keep charts presentational: they render a model and do no astronomy of their own.
  - Twilight bands come from scanning the sun's altitude and bisecting phase changes, _not_ from assembling `computeSunEvents`' individually-nullable crossings. That's what makes polar day/night fall out for free.
  - `altitudeToY` clamps to 0–90° on purpose: a set object runs flat along the baseline rather than leaving a gap.
  - `model.ts` caches the twilight bands for the last (window, location). They don't depend on the object and they're the expensive part of a model, so the per-row charts in the search results all hit the cache.
- `src/components/` — Svelte UI, laid out per `.plan/ui-mocks.md`: observatory list left, Search / Results tabview right.
  - `ObservatoryManager` is the **list only** — selection plus add/edit/delete. The form lives in `ObservatoryEditor`, opened as a modal, which never touches the store: it hands a validated `ObservatoryInput` to `onsave` or nothing at all. `ObservatoryManager` takes an optional `store` prop (defaults to the app-wide singleton) so tests can inject one over `MemoryStorage`.
  - Dialogs go through `Modal` / `ConfirmDialog`, not `<dialog>` and not `window.confirm`. `ObservatoryImportDialog` handles the export/import flow; `HelpDialog` holds the credits and catalog attribution (there is **no** attribution footer — it was removed).
  - `AllSkyChart` renders the polar view, `EventTimesPanel` the rise/set/twilight/moon rows, and `TimeSlider` drives the marker shared by both charts on the Results tab.
  - The search results render **one `AltitudeChart` per row**. Any chart component must therefore give its SVG ids per-instance (`$props.id()`) — a hard-coded id makes every chart on the page clip to the first one's plot.

## Decided stack (do not re-litigate without the user)

- Vite + Svelte 5 + TypeScript, `base: './'` (must keep working from both a subdomain and a path prefix — final URL is an open question)
- `astronomy-engine` (npm) for all ephemeris math — do not hand-roll coordinate transforms or rise/set searches
- Hand-rolled SVG for both charts (no charting library)
- Vitest for unit tests; astronomy results validated against Stellarium/USNO reference values
- `localStorage` for all persistence (single versioned key `skypath.observatories.v1`); no backend ever

## Styling

Must match the main site, whose sources are in the sibling repo `../voronin_cc` (Eleventy site; CSS at `static/css/styles.css`, fonts in `_includes/head.html`). Design tokens are already extracted into the implementation plan's "Visual design" section — use those as CSS custom properties in `src/theme.css` rather than re-deriving from the site. Fonts come from Google Fonts CDN (Red Hat Display, Fira Code), same `<link>` tags as the main site. External CDN resources are allowed; only a backend is excluded.

## Domain notes

- Horizon files are NINA-compatible: plain text, one `azimuth altitude` pair per line (azimuth 0–359°); interpolation must wrap around 360°→0°.
- "Above horizon" events compare object altitude to the _user horizon_ altitude at the object's current azimuth — distinct from the "above 0°" events; both are reported.
- Charts are centered on local midnight (time axis ≈ noon→noon); handle circumpolar / never-rises objects and polar day/night explicitly.
- Times display in the browser's local timezone (known limitation, noted in plan).
