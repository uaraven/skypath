# FlightPlan — Implementation Plan

Spec: [flightplan-spec.md](flightplan-spec.md)
UI mockups: [ui-mocks.md](ui-mocks.md) — the layout the app must have
Progress tracking: [state.md](state.md)

## Goal

A static single-page web application (no backend) that can be deployed to an S3
bucket as plain files, as part of the voronin.cc site. All logic — astronomy math,
catalogs, chart rendering — runs in the browser. External static resources (fonts,
CDN assets) are allowed; only a backend is excluded.

## Technology decisions

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Required by spec, type safety for coordinate math |
| Build tool | Vite | De-facto standard, zero-config static output, fast |
| UI framework | Svelte 5 | Popular, actively maintained, very small runtime bundle, trivial setup with Vite. (Alternative if preferred: React — more popular but heavier.) |
| Astronomy math | [astronomy-engine](https://www.npmjs.com/package/astronomy-engine) (npm) | Pure TS/JS, no dependencies, ±1 arcmin accuracy (VSOP87/NOVAS-based), provides equatorial→horizontal transforms, rise/set/culmination, twilight, moon phase. Actively maintained, MIT license. |
| Chart rendering | Hand-rolled SVG components | Both charts are custom projections (cylindrical altitude plot, polar all-sky view); charting libraries don't help here. SVG gives crisp rendering, easy styling, easy tooltips/hit-testing. |
| Messier catalog | Static JSON bundled at build time (110 objects: id, name, RA J2000, Dec J2000, type, magnitude) | Small (~15 KB), no runtime fetch needed |
| State persistence | `localStorage` — named **observatories** (location + horizon bundled), plus selected observatory / last object / date | No backend allowed |
| Styling | Plain CSS with custom properties, theme matching voronin.cc | Spec § Styling; site is plain CSS, no framework needed. Fonts loaded from Google Fonts CDN exactly like the main site (same `<link>` tags for Red Hat Display + Fira Code) |
| Deployment | `vite build` → `dist/` → `aws s3 sync` | Static files only; use relative base path (`base: './'`) so it works from any bucket/prefix |

## Architecture

```
src/
  lib/
    astro/
      types.ts          # SkyObject, HorizontalPos, Trajectory, EventTimes...
      catalog.ts        # Messier JSON + planets (+ Sun/Moon) as SkyObject list
      ephemeris.ts      # astronomy-engine wrapper: alt/az of object at time t
      trajectory.ts     # sample alt/az over the night window
      events.ts         # rises/sets/culmination vs 0° and vs custom horizon
      sun.ts            # sunset/sunrise, civil/nautical/astronomical twilight
      moon.ts           # moon trajectory, rise/set, phase (extended goal)
    horizon/
      parser.ts         # NINA horizon file parsing + validation
      horizon.ts        # interpolated altitude(azimuth) lookup
    observatory/
      types.ts          # Observatory = { id, name, lat, lon, horizonText }
      store.ts          # CRUD + selection, persisted to localStorage
    charts/
      AltitudeChart.svelte   # cylindrical projection, night-centered
      AzimuthalChart.svelte  # polar down-top view
      scales.ts              # projection/coordinate helpers shared by charts
  components/
    ObjectSearch.svelte   # Search tab: query box + result rows with thumbnails
    ResultsPanel.svelte   # Results tab: altitude chart, all-sky, event times
    ObservatoryManager.svelte # left panel: site list + add/edit/delete
    ObservatoryEditor.svelte  # the add/edit modal form
    LocationInput.svelte  # lat/lon/elevation input + browser geolocation button
    HorizonUpload.svelte  # file upload + paste textarea
    Modal.svelte          # shared dialog shell (scrim, Escape, focus)
    ConfirmDialog.svelte  # destructive-action confirmation
    EventTimesPanel.svelte    # Phase 6
  data/
    messier.json
  App.svelte
  main.ts
```

Key design points:

- **Observatories**: location and horizon are bundled into named observatories
  (spec § Observatories). All calculations read location + horizon from the
  currently selected observatory. Stored in localStorage under a single versioned
  key (e.g. `flightplan.observatories.v1` holding `{ selectedId, list }`); the
  horizon is stored as raw NINA text and re-parsed on load. Location entry offers
  manual lat/lon plus "use my location" via the Geolocation API.
- **Night window**: charts are centered on local midnight of the selected date;
  time axis runs roughly noon → noon so the whole night is contiguous.
- **Trajectory sampling**: compute alt/az at fixed steps (e.g. every 5 min) across
  the window with astronomy-engine's `Horizon()`; refine event times with its
  `SearchAltitude()`/`SearchRiseSet()` where applicable, and custom bisection for
  crossings of the user horizon.
- **Custom horizon crossings**: "above horizon" / "sets at horizon" compare object
  altitude against the interpolated horizon altitude at the object's current
  azimuth — solved by sampling + bisection on `alt(t) − horizonAlt(az(t))`.

## UI layout (per `ui-mocks.md`)

The app is a two-panel shell, built ahead of Phases 5–6 so those land in their
final slots rather than in a scratch layout:

- **Left**: the observatory list, with add / edit / delete beneath it. Selecting
  a site drives every calculation on the right. Adding and editing open the
  `ObservatoryEditor` **modal**; deleting goes through a confirmation dialog.
- **Right**: a tabview.
  - **Search** — a query box over the catalog, and a result row per match
    showing the object's names, all its designations, and a **thumbnail
    altitude chart** for the selected site. Picking a row switches to Results.
  - **Results** — the altitude chart, the all-sky view (Phase 5), and the event
    times (Phase 6) for the chosen object.
- The date lives in the tab bar, applying to both tabs.

Consequences worth recording:

- The thumbnail charts mean **many chart instances on one page**. Each needs its
  own SVG clip-path id, and the twilight bands — the expensive part of a model,
  and identical for every row — are cached per (window, location) in
  `charts/model.ts`.
- Search is debounced; results are capped and sampled coarsely, because every
  row costs a trajectory.
- Dialogs are hand-rolled (`Modal.svelte`) rather than `<dialog showModal>`,
  which keeps them testable without depending on how completely jsdom
  implements dialog semantics.

## Visual design (consistency with voronin.cc)

Design tokens extracted from `../voronin_cc/static/css/styles.css`, defined once in
`src/theme.css` as CSS custom properties and used by both UI and SVG charts:

| Token | Value | Source usage |
|---|---|---|
| `--bg` | `rgb(16, 31, 37)` | body background |
| `--bg-panel` | `rgba(1, 20, 29, 0.5)` | cards (`.project-card`, `.blog-post-card`) |
| `--bg-inset` | `rgb(26, 41, 47)` | code/data blocks |
| `--text` | `#f5f5dc` | body text |
| `--heading` | `#c3cfec` / `#a3afbe` | h2 / card h3 |
| `--accent` | `#228da8` | links |
| `--accent-bright` | `#74bbf1` | hover, hero text |
| `--border` | `rgba(98, 169, 255, 0.3)` | card borders |
| Fonts | "Red Hat Display" (UI), "Fira Code" (mono/data) | site-wide |
| Shape/motion | 10px card radius, pill buttons (20–50px), `0.3s ease` transitions | site-wide |

Chart-specific mapping: night = `--bg`, twilight bands = stepped blends toward a
day color, trajectory = `--accent-bright`, horizon fill = dark inset tone,
grid/labels = `--text` at reduced opacity, panels framed like `.project-card`.
The dark theme is a natural fit for an astronomy tool (night-vision friendly);
consider an optional red-light mode later (not in scope).

Fonts are loaded from the Google Fonts CDN with the same `<link>` tags the main
site uses (`_includes/head.html`) — identical faces and loading behavior.

## Phases

### Phase 0 — Project scaffolding
- `npm create vite@latest` (svelte-ts template), add astronomy-engine.
- Configure `vite.config.ts` with `base: './'` for S3-prefix-agnostic deploys.
- Prettier + ESLint, `npm run build` producing `dist/`.
- `src/theme.css` with voronin.cc design tokens (see Visual design section); Google Fonts `<link>` tags for Red Hat Display + Fira Code in `index.html` (same as main site's `head.html`).
- Minimal App shell rendering "FlightPlan" already themed (dark bg, Red Hat Display).
- **Done when:** `npm run dev` and `npm run build` work; dist opens from `file://` or any static host.

### Phase 1 — Astronomy core
- `types.ts`, `ephemeris.ts`: alt/az for a given RA/Dec or planet at time + location.
- `sun.ts`: sunset, sunrise, civil/nautical/astronomical dusk & dawn for a date/location.
- `trajectory.ts`: sampled trajectory over the night window.
- Unit tests (Vitest) against known values (e.g. Stellarium/USNO cross-checks).
- **Done when:** tests pass for a few reference objects/dates/locations.

### Phase 2 — Catalogs
- Build `messier.json` (110 objects with RA/Dec J2000, common names, type, magnitude).
- `catalog.ts` exposing Messier + Mercury…Neptune (+ Moon for extended goal).
- **Done when:** catalog loads, every object resolves to a valid trajectory.

### Phase 3 — Horizon & observatories
- NINA file parser (`azimuth altitude` per line; tolerate comments/blank lines, validate ranges).
- Linear interpolation across 0–360° with wraparound; default flat horizon (0°) when none set.
- Observatory model + localStorage store: create/select/edit/delete named observatories bundling location (lat/lon) and horizon text; one is always selected.
- Upload (File API) + paste (textarea) UI writing into the selected observatory.
- **Done when:** sample NINA file parses; `horizonAlt(az)` correct incl. wraparound; observatories survive a page reload and CRUD works.

### Phase 4 — Altitude chart
- SVG cylindrical plot: x = time (noon→noon, night-centered), y = altitude 0–90°.
- Background bands: day / civil / nautical / astronomical twilight / night from Phase 1 sun times.
- Object trajectory curve; horizon drawn as alt-vs-time curve along the object's azimuth track (matching the reference image); axis labels and time ticks.
- **Done when:** visually matches `altitude.png` reference for a test case.

### Phase 4.5 — UI shell (inserted after Phase 4, before Phase 5)

Added at the user's request once `ui-mocks.md` existed: build the real layout
now, so Phases 5 and 6 fill in prepared slots instead of being wired into a
placeholder `App.svelte` and then moved.

- Two-panel shell: observatory list left, Search / Results tabview right.
- `ObservatoryManager` reduced to the list + add/edit/delete; the form moves
  into the `ObservatoryEditor` modal, with `Modal` and `ConfirmDialog` shared.
- `ObjectSearch`: debounced catalog search, result rows with a compact
  `AltitudeChart` per row.
- `ResultsPanel`: full altitude chart plus labelled placeholders for the
  all-sky view and the event times.
- Date picker in the tab bar (not in the mock, but the spec needs a date and
  the charts were otherwise pinned to today).
- **Done when:** the app matches the mockups, the observatory flow works
  through the modals, and picking a search result opens it in Results.

### Phase 5 — Azimuthal chart
- SVG polar plot: outer rim = 0° altitude, center = zenith, N at top, E/W per down-top convention.
- Cardinal points N/S/E/W, azimuthal grid (altitude circles + azimuth spokes).
- Horizon polygon wrapped around the rim; object trajectory with time direction markers.
- Fills the "All-sky view" slot already laid out in `ResultsPanel`; follow
  `AltitudeChart`'s shape — model under `lib/charts/`, component in
  `src/components/`, unique SVG ids.
- **Done when:** visually matches `azimutal.png` reference.

### Phase 6 — Event times
- Object: rises above 0°, rises above custom horizon, max altitude (time + value), sets below custom horizon, sets below 0°.
- Sun: sunset, sunrise, all three twilight/dawn pairs.
- Moonrise, moonset and moon phase belong here too (the mock lists them under
  the times panel), though the Moon's own trajectory stays in Phase 8.
- `EventTimesPanel` listing local times, filling the "Times and directions"
  slot in `ResultsPanel`; handle circumpolar / never-rises cases gracefully.
- **Done when:** times match Stellarium within ~1 min for test cases.

### Phase 7 — App assembly & UX
Most of the assembly moved into Phase 4.5; what remains is persistence, polish
and the things only visible once all the content is real.
- Persist the remaining inputs (selected object, date) alongside the
  observatories; restore them on load. The observatory list already persists.
- Responsive pass with real content in place: charts must scroll/scale on small
  screens, and the two-panel split has to collapse cleanly.
- Styling pass against voronin.cc side by side; keyboard and focus behaviour
  for the tabview and the modals (arrow-key tab navigation, focus restored to
  the opener on close).
- Show the OpenNGC attribution (`catalogSources`) in the credits — CC-BY-SA-4.0
  requires it.
- **Done when:** full user flow works end-to-end in the browser and the app is visually consistent with voronin.cc side by side.

### Phase 8 — Extended goal: Moon
- Moon trajectory on both charts (distinct style), moonrise/moonset in events panel, moon phase (illumination % + name/icon).
- **Done when:** moon data matches reference sources.

### Phase 9 — Build, deploy & polish
- `deploy.sh`: `npm run build && aws s3 sync dist/ s3://<bucket>[/flightplan] --delete` (model on the main site's `deploy.sh`).
- Resolve open question: subdomain (flightplan.voronin.cc) vs path (voronin.cc/flightplan) — `base: './'` keeps the build working for either, so the decision can wait until deploy time.
- Optional: link/navbar integration with the main site.
- README with usage + deploy instructions; final cross-browser check (Chrome/Firefox/Safari).
- **Done when:** app fully functional when served from its S3 location under voronin.cc.

## Risks / open questions

- **Deployment URL (open)**: subdomain flightplan.voronin.cc vs path voronin.cc/flightplan — undecided. Build with `base: './'` works for both; decide in Phase 9.
- **Timezone handling**: display times in the browser's local timezone (assume the observer is at the browser's locale); note as limitation for remote-location planning.
- **Horizon rendering on the altitude chart**: the horizon line depends on the object's azimuth at each time — worth confirming against NINA's own rendering.
- **Messier catalog data source**: compile from public-domain data; verify a handful of entries against SIMBAD.
- **Circumpolar objects and polar-day/night sun cases** need explicit "never rises/sets" handling in both events and chart shading.
