# FlightPlan

A static single-page web app for planning a night of astronomical observation. Pick a target, a date and an observatory, and see where the object goes across the sky that night — against _your_ horizon, not an idealised flat one.

No backend, no accounts, no server-side state. Everything runs in the browser and everything you save stays in `localStorage`.

## Why

Planning a session means answering a few concrete questions: is the object up tonight, when is it highest, and is it actually visible from where I stand — or is it behind the neighbour's roofline until 1 a.m.? Planetarium software answers the first two well and the third one rarely. FlightPlan takes a measured horizon profile as a first-class input, so "above the horizon" means the horizon you actually have.

## What it does

**Two charts of the night, both centred on local midnight** (the window runs roughly noon → noon):

- **Altitude chart** — the sky unwrapped: object altitude against time, with day, twilight and night shaded behind it, and your horizon drawn as the obstruction along the object's own azimuth track.
- **All-sky chart** — a circular down-top view. Rim is altitude 0°, centre is the zenith, north at the top. The trajectory is cut at the rim into separate passes, with hour marks showing which way time runs, and the obstruction drawn as a wall around the edge.

A time slider under the charts links them: both flag the same moment with a marker.

**Event times**, in a 24-hour clock, local timezone:

- object rises above 0° / above your horizon
- object at maximum altitude (transit), with the altitude and direction
- object sets below your horizon / below 0°
- sunset, sunrise, and civil / nautical / astronomical twilight and dawn
- moonrise, moonset and the moon phase

Non-events are answers too: _circumpolar — always up_, _never rises_, _stays blocked_, _polar day_. The app says which rather than printing a dash.

**Targets** — about 15 000 deep-sky objects (Messier, NGC, IC, Sharpless 2 and LDN) plus the solar system planets, searchable by any designation or common name (`M13`, `messier 13`, `NGC 6205`, bare `6205`, `Sh2-155`, `Hercules`). The catalogue model is multi-catalog by design: an object belongs to many catalogues and carries many names, so M 13 and NGC 6205 are one entry with two numbers, not two rows.

**Observatories** — named bundles of an observer location and a horizon, created, edited, selected and deleted in-app, persisted to `localStorage`. The selected one drives every calculation and both charts.

**Horizons** are NINA-compatible plain text: one `azimuth altitude` pair per line, azimuth 0–359. Upload a file or paste it. Interpolation wraps around 360° → 0°, so the segment through north is handled like any other. Parse problems are reported with line numbers instead of rows being silently dropped.

## Running it

```sh
npm install
npm run dev        # Vite dev server
npm run build      # static files into dist/
npm run preview
```

The build uses `base: './'` and emits plain files — it works from a subdomain or from a path prefix, and deploys by copying `dist/` to any static host.

### Development

```sh
npm test           # all three Vitest projects
npm run check      # svelte-check + tsc
npm run format     # Prettier
npm run catalog:build   # regenerate catalogue JSON from OpenNGC and VizieR
```

Tests are split into three Vitest projects, chosen by directory rather than filename:

| Project      | Environment                  | Covers              |
| ------------ | ---------------------------- | ------------------- |
| `unit`       | Node                         | `src/lib/**`        |
| `components` | jsdom + Testing Library      | `src/components/**` |
| `visual`     | real Chromium via Playwright | `src/visual/**`     |

The visual project exists for what jsdom cannot answer — computed layout, applied fonts, real visibility, chart geometry. `npm run test:visual:open` runs it headed; screenshots land in `screenshots/`.

## Built with

[Svelte 5](https://svelte.dev) + TypeScript on [Vite](https://vite.dev), with [astronomy-engine](https://github.com/cosinekitty/astronomy) for all ephemeris math. Both charts are hand-rolled SVG — no charting library. Tests run on [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev).

## Layout

```
src/lib/astro/       ephemeris, sun/twilight, trajectory, events, moon
src/lib/catalog/     deep-sky catalogues + solar system, search, multi-catalog merge
src/lib/horizon/     NINA parsing, circular interpolation
src/lib/observatory/ location + horizon bundles in localStorage
src/lib/charts/      chart geometry and data models (no Svelte)
src/components/      the Svelte UI, including both chart components
```

## Data and credits

Messier, NGC and IC are generated from [OpenNGC](https://github.com/mattiaverga/OpenNGC), licensed **CC-BY-SA-4.0** — attribution is a licence obligation and is shown in the app's credits. Sharpless 2 and LDN come from the VizieR tables VII/20 (Sharpless 1959) and VII/7A (Lynds 1962), cited in the same credits. The JSON under `src/lib/catalog/data/` is generated by `npm run catalog:build`; don't hand-edit it.

## Known limitations

- Times display in the browser's local timezone.
- The Moon as a _target_ is not finished (its trajectory is drawn from the body centre, while the moonrise row correctly uses the upper limb — the two read a couple of minutes apart).

## Licence

[GPL-3.0](LICENSE).
