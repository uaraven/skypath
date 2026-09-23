# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SkyPath** — a static single-page web app (no backend) for planning astronomical observations: pick a target (Messier object or planet), a date, and an observatory (location + custom horizon), and see the target's sky trajectory plus rise/set/culmination and twilight times. Deploys as plain files to S3 as part of the voronin.cc site. The directory is named `skyproject/` for historical reasons; the project name is SkyPath.

## Current state: all phases (0–10) done, plus the framing assistant — the app is complete and deployed

Both charts (altitude + all-sky/azimuthal), event times, the linked time slider, observatory CRUD with JSON export/import, a Help dialog, the Moon (both as an optional overlay and as a selectable target — trajectory/rise/set/phase), and a **framing assistant** for deep-sky targets are all in. The app is built and deployed to **skypath.voronin.cc** (subdomain, decided in phase 9). See `.plan/state.md` for the authoritative per-phase table and `.plan/framing-assistant-plan.md` for the framing assistant's design decisions.

The framing assistant replaced the plain Aladin Lite sky-view block (`FramingAssistant.svelte`, formerly `ObjectSkyView.svelte`): the sidebar gained a second managed collection, **rigs** (telescope + camera, `src/lib/rig/`), and selecting one sizes the sky view to the rig's field, draws a rectangle for what the sensor sees, and adds a 0–360° rotation slider. With no rig selected it behaves exactly as the old sky view did.

The Moon is drawn two ways and they must not collide: as a **companion overlay** on both charts (the "Show the Moon" toggle → `includeMoon`, a dashed `.moon-track` + phase glyph), and as the **selected target** itself. When `object.id === MOON.id` the chart models fill the same `moon` field from the _primary_ trajectory (glyph only, no second sample), the components skip the redundant dimmed track/peak marker, and `ResultsPanel`/`EventTimesPanel` suppress the now-duplicate overlay toggle and standalone "Moon" times group.

Planning documents live in `.plan/`:

- `.plan/skypath-spec.md` — requirements (source of truth for functionality)
- `.plan/ui-mocks.md` — the layout the app must have (source of truth for UI structure)
- `.plan/implementation-plan.md` — tech decisions, architecture, phases 0–9 with "done when" criteria
- `.plan/state.md` — per-phase status table and decision log. **Keep this updated**: mark phase status changes and append dated log entries for any decision or requirement change.
- `.plan/framing-assistant-plan.md` — the rigs + framing assistant feature: data model, optics, the SVG-frame-over-Aladin decision, and the rotation-sign convention
- `altitude.png` / `azimutal.png` — reference renderings the two chart types must visually match

## Commands

- `npm run dev` — Vite dev server
- `npm run build` / `npm run preview`
- `npm test` (`test:watch`) — Vitest; `npm run check` — svelte-check + tsc
  - Three projects: `test:unit` (Node, `src/lib/**`), `test:components` (jsdom + Testing Library, `src/components/**`) and `test:visual` (real Chromium via Playwright, `src/visual/**`). Put a test next to what it covers; the project is chosen by directory, not by filename.
  - Visual tests are for what jsdom cannot answer — computed layout, applied fonts, real visibility, chart geometry. `npm run test:visual:open` runs them headed; screenshots land in `screenshots/` (gitignored). `src/visual/tester.html` must keep the same font `<link>`s as `index.html`, or the browser falls back to Helvetica while `font-family` still reports the declared face. The Playwright instance also pins `context.timezoneId` — `env: { TZ }` only reaches the Node process, and since the charts are built from _local_ noon, the host timezone would otherwise draw a different night than the assertions compute.
- `npm run format` — Prettier
- `npm run lint` (`lint:fix`) — ESLint (TypeScript + Svelte, flat config in `eslint.config.js`)
- `npm run catalog:build` — regenerate `src/lib/catalog/data/*.json` from OpenNGC (Messier/NGC/IC) and VizieR (Sharpless 2, LDN, LBN)

## Code layout

- `src/lib/astro/` — ephemeris, sun/twilight, trajectory sampling. Knows nothing about catalogs.
  - Watch the refraction convention: twilight is _geometric_ altitude, rise/set and the charts are _apparent_. See `AltitudeConvention` in `ephemeris.ts`.
  - `angularSeparation` in `ephemeris.ts` gives the angle between any two `SkyObject`s as seen from a location, via astronomy-engine's `AngleBetween` over topocentric of-date equatorial vectors — accounts for the Moon's parallax, unlike a raw catalogue-coordinate comparison.
  - Deep-sky objects reach astronomy-engine via `withEngineBody()`, which reuses one shared `Body.Star1` slot — never retain the `Body` past the callback.
  - `yearly.ts` samples altitude at local midnight every day of a calendar year for the Results tab's yearly chart — distinct from `trajectory.ts`'s single-night sampling. Same cadence for every object, including the Moon.
- `src/lib/catalog/` — targets the user can pick. `index.ts` is the public API (`searchObjects`, `objectById`, `objectByDesignation`, `allObjects`).
  - An object belongs to **many catalogs and has many names** — `CatalogObject.designations` / `.names`. Don't collapse either to a single value.
  - To add a catalog: register it in `catalogs.ts`, generate JSON into `data/`, import it in `dso.ts`. Entries sharing a designation merge into one object.
  - Bundled: Messier, NGC, IC (from OpenNGC) and Sharpless 2, LDN, LBN (from VizieR) — ~15 200 objects. Caldwell (`C`) numbers are lifted from OpenNGC's `Identifiers` column and fold into the NGC/IC objects they name (like UGC/PGC — no file of their own; 105 of 109, the four not in NGC/IC are absent). Data is generated, never hand-edit `data/*.json`. OpenNGC is **CC-BY-SA-4.0 — attribution required** (all sources exposed as `catalogSources`).
  - Sharpless/LDN **do not cross-match** to NGC/IC: no shared designations exist in either source, so NGC 7000 and Sh2-117 are two entries, and neither VizieR catalog carries common names. LBN is the exception — OpenNGC's `Identifiers` column already tags ~99 of its 1125 numbers onto the NGC/IC object they name, so `lbn.json`'s rows for those merge in rather than duplicating; the rest become standalone objects. See `data/README.md`.
- `src/lib/horizon/` — NINA file parsing and `Horizon.altitudeAt(azimuth)`. The azimuth axis is circular: the segment between the last and first point wraps through north, and getting that wrong silently reports a clear horizon.
- `src/lib/observatory/` — named location + horizon bundles in localStorage. Invariants: the list is never empty and one is always selected. The horizon is stored as **raw text**, parsed on the render path by the memoizing `horizonFromText`.
  - `transfer.ts` moves observatories between machines as a tagged JSON file (`serializeObservatories` / `parseObservatoryImport`). `selectedId` is deliberately **not** exported — highlight is a property of the browser, not the collection — and the horizon travels as its raw NINA text, so a round trip is byte-for-byte.
- `src/lib/rig/` — telescope + camera bundles (`Rig`) for the framing assistant, in localStorage under `skypath.rigs.v1`. Same store shape as `observatory/`, with one deliberate divergence: **the list may be empty and `selectedId` may be null** — nothing in the app needs a rig, so there is no fabricated default. The camera is stored as resolution + pixel pitch only (sensor mm is derived, never persisted — both entry styles the spec allows collapse to this one canonical form). `sensors.ts` holds the twelve built-in chip presets as frozen data; `optics.ts` (`rigOptics`) computes image scale, field of view (exact `2·atan`, not small-angle), f-ratio, and the Dawes diffraction limit (`116/D`, not Rayleigh's `138/D` — the spec's "diffraction limit" reads as the amateur-calculator convention).
  - `lib/rig` and `lib/observatory` never import each other; anything needing both (export/import) lives one level up, in `lib/transfer`.
- `src/lib/transfer/` — moves **both** managed collections (observatories + rigs) as one JSON file (`serializeBackup` / `parseBackup`, `BACKUP_VERSION` 2). Lenient about the container, same spirit as `observatory/transfer.ts`: a v1 observatory-only export (bare array or `{observatories}`) still imports, with `rigs: []`. `selectedId` is not exported for either collection.
- `src/lib/charts/` — chart geometry and data, no Svelte. Altitude chart: `scales.ts` (projection into an SVG `PlotArea`), `sky-bands.ts` (twilight shading), `model.ts` (`altitudeChartModel` — everything a chart draws, computed once). All-sky/azimuthal chart: `polar.ts` (the **down-top** projection — the E/W handedness convention lives here) + `all-sky.ts` (its model). `marker.ts` is the shared time-slider marker both charts flag the current moment with; `moon-glyph.ts` the Moon phase glyph.
  - The **chart components live in `src/components/`**, not here, so Vitest's Node `unit` project doesn't collect them. Keep charts presentational: they render a model and do no astronomy of their own.
  - Twilight bands come from scanning the sun's altitude and bisecting phase changes, _not_ from assembling `computeSunEvents`' individually-nullable crossings. That's what makes polar day/night fall out for free.
  - `altitudeToY` clamps to 0–90° on purpose: a set object runs flat along the baseline rather than leaving a gap.
  - `model.ts` caches the twilight bands for the last (window, location). They don't depend on the object and they're the expensive part of a model, so the per-row charts in the search results all hit the cache.
  - `yearly.ts` (`yearlyChartModel`) is the third, deliberately thin model for the Results tab's yearly-altitude chart: no horizon track, no Moon overlay, no twilight bands — just the object's midnight altitude across the selected date's calendar year, with the year swapping wholesale when the date crosses a New Year boundary.
- `src/lib/images/` — `aladinViewParams` computes the Aladin Lite target/fov/survey for the plain sky view (deep-sky only, no rig). Pure computation only; the app never loads Aladin itself from here (see `aladinLoader.ts`, below). RA is catalogued in **hours** and the target string wants **degrees** (×15), and coordinates must be the **J2000 catalogue** ones, not `equatorialPosition`'s of-date output. Default survey is `P/DSS2/color`.
  - `framing.ts` (`framingViewParams`) builds on `aladin.ts` for the framing assistant: with a rig, the view is sized to `FRAME_MARGIN` (1.25) × whichever is larger, the rig's field of view or the object's own size, and returns `frame` — the rig's field as a fraction of the (square) view box, for the component to draw as a rectangle. With no rig it degrades to exactly `aladinViewParams`'s object-sized view. Depends on `lib/rig` for `rigOptics`.
- `src/components/` — Svelte UI, laid out per `.plan/ui-mocks.md`: sidebar left (observatories + rigs), Search / Results tabview right.
  - `Sidebar` renders `ObservatoryManager` + `RigManager` and owns what's shared between them: the one overflow menu, the hidden file input, the export download, and the import dialog. Each manager owns only its own list's selection and add/edit/delete dialogs.
  - `ObservatoryManager` / `RigManager` are **list only** — selection plus add/edit/delete. The forms live in `ObservatoryEditor` / `RigEditor`, opened as modals, which never touch the store: they hand a validated input to `onsave` or nothing at all. Both managers take an optional `store` prop (defaults to the app-wide singleton) so tests can inject one over `MemoryStorage`. Unlike observatories, the rig list may be **empty** with nothing selected — `RigManager`'s edit/delete buttons disable accordingly, and its delete confirmation carries no "a default will take its place" text.
  - `RigEditor` shows the sensor width/height in mm alongside pitch, **live-linked**: typing a physical sensor size solves back for the pitch that would produce it at the current pixel count, so neither "I know my pitch" nor "I know my sensor size" is a mode picked up front. Picking a built-in sensor (`lib/rig/sensors.ts`) seeds every field but leaves them editable; the remembered `sensorId` is cosmetic (which dropdown entry to show again) and isn't cleared by editing a field afterwards.
  - Dialogs go through `Modal` / `ConfirmDialog`, not `<dialog>` and not `window.confirm`. `ImportDialog` (formerly `ObservatoryImportDialog`) handles the combined export/import flow, with a checkbox per collection so append/overwrite can apply to observatories, rigs, or both independently; `HelpDialog` holds the credits and catalog attribution (there is **no** attribution footer — it was removed).
  - `AllSkyChart` renders the polar view, `EventTimesPanel` the rise/set/twilight/moon rows, and `TimeSlider` drives the marker shared by both charts on the Results tab. `YearlyChart` sits below `AllSkyChart` and is not on the shared night timeline — it plots the calendar year, not the night, so it has no scrub/marker-time prop, only its own "current date" dot from `yearlyChartModel`'s `current` field.
  - `FramingAssistant` (formerly `ObjectSkyView`) is the collapsible Aladin Lite block. It takes ready-made `target`/`fov`/`survey`/`frame` (the panel builds them via `framingViewParams`) and only mounts a container **while open**, so a collapsed block costs no CDN/WASM download. Loading Aladin itself goes through the injectable `loadAladin` prop (default `loadAladinView` from `./aladinLoader.ts`, which injects the CDN `<script>`, checks WebGL2 first, and times out — Aladin Lite has no documented tile-load-failure event, unlike the old SkyView `<img>`'s `onerror`) — tests inject a fake loader instead, the same pattern the managers use for their `store` prop. The loader resolves an `AladinHandle` (`{ setFov }`) rather than `void`, so a rig switch re-fovs the live instance in place instead of remounting — Aladin still has no API to _re-target_ or destroy an instance, so a changed object or a Retry still remounts a fresh container via a keyed block. The camera-frame rectangle and rotation are drawn as a **plain SVG overlay**, not an Aladin graphic overlay: the documented API has no per-shape removal (only `removeLayers()`, which would wipe everything on every slider tick), and `pointer-events: none` on the Aladin container (already there to keep the view static) is what keeps the overlay's geometry from ever drifting out of sync. The rotation slider is a position angle (north through east); since Aladin renders north-up/**east-left**, the screen rotation is `-positionAngleDeg`. The visual project must never let this reach aladin.cds.unistra.fr — `setup-visual.ts` collapses it and the dedicated test (`src/visual/framing.test.ts`) injects a fake `loadAladin` that paints synthetic DOM.
  - The search results render **one `AltitudeChart` per row**. Any chart component must therefore give its SVG ids per-instance (`$props.id()`) — a hard-coded id makes every chart on the page clip to the first one's plot.

## Decided stack (do not re-litigate without the user)

- Vite + Svelte 5 + TypeScript, `base: './'` (must keep working from both a subdomain and a path prefix — final URL is an open question)
- `astronomy-engine` (npm) for all ephemeris math — do not hand-roll coordinate transforms or rise/set searches
- Hand-rolled SVG for both charts (no charting library)
- Vitest for unit tests; astronomy results validated against Stellarium/USNO reference values
- `localStorage` for all persistence — a single versioned key per collection (`skypath.observatories.v1`, `skypath.rigs.v1`, `skypath.session.v1`); no backend ever

## Styling

Must match the main site, whose sources are in the sibling repo `../voronin_cc` (Eleventy site; CSS at `static/css/styles.css`, fonts in `_includes/head.html`). Design tokens are already extracted into the implementation plan's "Visual design" section — use those as CSS custom properties in `src/theme.css` rather than re-deriving from the site. Fonts come from Google Fonts CDN (Red Hat Display, Fira Code), same `<link>` tags as the main site. External CDN resources are allowed; only a backend is excluded.

## Domain notes

- Horizon files are NINA-compatible: plain text, one `azimuth altitude` pair per line (azimuth 0–359°); interpolation must wrap around 360°→0°.
- "Above horizon" events compare object altitude to the _user horizon_ altitude at the object's current azimuth — distinct from the "above 0°" events; both are reported.
- Charts are centered on local midnight (time axis ≈ noon→noon); handle circumpolar / never-rises objects and polar day/night explicitly.
- Times display in the browser's local timezone (known limitation, noted in plan).
