# Implementation plan — DSO preview image (SkyView)

Spec: [object-img.md](object-img.md). Proposed as **Phase 10**.

## Goal restated

On the Results tab, above the object title, show a DSS sky image of the selected
deep-sky object fetched from NASA SkyView, sized from the object's catalogued
apparent size (default 30′ when it has none), inside a collapsible block, with a
spinner while it loads.

## What I verified against the live service before planning

- `https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?Survey=dss2r&position={ra_deg},{dec}&Return=GIF&size={deg}&pixels={px}`
  returns `200 image/gif` directly — no redirect, no HTML wrapper, no batch/poll step.
- **`position` is in decimal degrees.** Our `DeepSkyObject.ra` is in **hours**
  ([types.ts:31](src/lib/astro/types.ts#L31)) — the builder must multiply by 15.
  Getting this wrong yields a plausible-looking star field of the wrong sky.
- Response headers carry **no `Access-Control-Allow-Origin`**. That is fine and it
  drives the central decision below: we load through `<img src>`, never `fetch`.
  A `fetch`/blob approach would need a proxy, i.e. a backend, which the project
  forbids. Do **not** put `crossorigin` on the `<img>` — it would opt into a CORS
  check that fails.
- Latency is real: **~7 s** for a 512 px / 3° cutout, ~0.6 s for a cached-ish
  small one. The spinner is not decoration.
- **Errors come back as `200 image/gif`.** A bad survey name returns a 4.7 KB GIF
  with the error text drawn into it. So a failed query is *not* detectable
  client-side; `onerror` only catches network-level failure. Plan honestly for
  this: no fake error handling that cannot fire (see step 3).
- J2000 is the default frame; `coordinates=J2000` is accepted and harmless.
  Send it explicitly — our catalogue coordinates are J2000 and the default is
  the service's business, not ours.
- Checked a −72° dec field: DSS2R returns imagery, so southern targets are covered.

## Design decisions

1. **URL building is pure and lives in `src/lib/` — not in the component.**
   New `src/lib/images/skyview.ts`, unit-tested by the Node `unit` project.
   The component stays presentational, matching the charts' rule (a component
   renders a model and does no astronomy of its own).
2. **The component takes a `url`, it does not compute one.** `ResultsPanel`
   decides whether there is an image at all and hands over a string. This keeps
   `ObjectImage` trivially testable in jsdom and lets a visual test feed it a
   `data:` URI instead of hitting NASA from the test suite.
3. **Deep-sky only.** Planets and the Moon move against the background stars, so
   a fixed-coordinate survey cutout of where they happen to be is misleading.
   Gate on `isDeepSky(object)`; the block is absent, not empty, for other targets.
4. **Coordinates come from the catalogue (`object.ra` / `object.dec`), not from
   `equatorialPosition`.** The latter returns apparent, precessed-to-date
   coordinates for the observer; SkyView wants the J2000 catalogue position.
5. **Lazy: `src` is only set when the block is open.** Collapsing must not waste
   a 250 KB download, and a user who works with the panel collapsed should never
   trigger the request. Consequence: the spinner appears on first expand, not on
   page load.

## Steps

### 1. `src/lib/images/skyview.ts` (+ `index.ts`)

```ts
export interface SkyViewOptions {
  survey?: string      // default 'dss2r'
  pixels?: number      // default 300 (user-specified cap)
  fieldDegrees?: number // override; otherwise derived from the object
}

export function skyViewFieldDegrees(sizeArcmin: number | undefined): number
export function skyViewUrl(object: DeepSkyObject, options?: SkyViewOptions): string
```

- `skyViewFieldDegrees`: `size` (arcmin, major axis) × a framing factor of **1.5**
  so the object does not fill the frame edge-to-edge, ÷ 60; falls back to the
  spec's **30′** when `size` is undefined; then **clamped to 0.1°–5°**.
  The clamp is load-bearing in both directions — LDN entries carry no size but
  NGC/IC hold degree-scale objects, and a 5°+ cutout is slow and unreadable;
  below ~0.1° DSS plates are just noise.
- `skyViewUrl`: `ra * 15` → degrees, `URLSearchParams` for encoding, fixed
  `Return=GIF`, `coordinates=J2000`.
- Tests (`skyview.test.ts`, unit project): RA hours→degrees conversion pinned with
  a known object (M 31 → `10.68…`), the 30′ default, both clamp ends, the
  framing factor, and that the query string parses back to the expected params.

### 2. `src/components/ObjectImage.svelte`

Props: `{ url: string; alt: string; open?: boolean (bindable) }`.

- Disclosure is a `<button aria-expanded>` + a region — **not** `<details>`,
  because the codebase already rejects native `<dialog>` for the same reason
  (consistent styling and testability). Header line: "Sky image (DSS)" plus the
  field of view, and a chevron.
- Body: fixed-aspect square box (`aspect-ratio: 1`) capped at **300 px**
  (`width: min(100%, 300px)`), so the 300×300 GIF maps 1:1 with no upscaling and
  the layout does not jump when the image arrives — reserving the box removes
  the single biggest visual risk.
- State machine: `idle → loading → loaded | failed`, driven by `onload`/`onerror`.
  A `$derived` on `url` resets to `loading` when the object changes so the
  spinner reappears; the `<img>` is keyed on `url` so a stale decoded frame is
  never shown next to a new title.
- Spinner: CSS-only rotating ring, `role="status"` + `aria-live="polite"` with
  visually-hidden "Loading sky image", and `aria-busy` on the region.
- `failed` state renders a short message and a **Retry** button (re-sets `src`
  with a cache-busting nonce). Per the finding above, this fires only on network
  failure — the message must therefore say "couldn't load", not "no imagery for
  this object", which we cannot know.
- `alt` = e.g. `"DSS sky image of the Andromeda Galaxy"`; the image is content,
  not decoration.
- Styling from `src/theme.css` tokens; the GIF is greyscale so it sits fine in
  both themes, but give it a `--surface` backdrop and the panel border radius.

### 3. Wire into `ResultsPanel.svelte`

- `const image = $derived(object && isDeepSky(object) ? { url: skyViewUrl(object), alt: … } : null)`
- Render `{#if image}<ObjectImage … />{/if}` **above `<header>`** inside `.results`,
  per the spec's "above the title".
- Nothing else in the panel changes; the charts and event times are untouched.

### 4. Remember the collapsed state (session)

Add `imageOpen?: boolean` to `Session` in [store.ts](src/lib/session/store.ts).
Additive and read tolerantly (`typeof === 'boolean' ? … : true`), so **keep
`SCHEMA_VERSION` at 1** — bumping it would orphan every saved session for a
purely additive field. Default **open**, matching the spec's framing (the block
exists so it *can* be closed).

### 5. Attribution in `HelpDialog.svelte`

The project treats attribution as an obligation, and this adds a third-party data
source. Add a line crediting **NASA SkyView** ("the SkyView Virtual Observatory,
NASA/GSFC") and the **DSS/POSS** plate origin (AURA/STScI, Caltech), alongside the
existing OpenNGC/VizieR credits.

### 6. Tests

- **Unit** (`src/lib/images/skyview.test.ts`) — as in step 1.
- **Components** (`src/components/ObjectImage.test.ts`) — jsdom never fires `load`
  for a real network image, so dispatch `new Event('load')` / `'error'` on the
  `<img>` by hand. Cover: collapsed renders no `<img>` (the lazy-src invariant);
  expanding sets `src`; spinner present while loading and gone after `load`;
  `error` shows the retry affordance; changing `url` returns to the spinner.
- **Components** (`ResultsPanel.test.ts`) — the block appears for a catalogue
  object and is **absent** for Jupiter and the Moon; the `src` carries the right
  RA in degrees.
- **Visual** — one case only, with a `data:` URI passed as `url`, asserting the
  reserved square box and that expand/collapse changes computed height. **No
  visual test may hit skyview.gsfc.nasa.gov** — a 7 s third-party dependency in
  the suite is a flake generator.

### 7. Docs

`.plan/state.md`: add the Phase 10 row and a dated log entry recording the
decisions above — particularly the no-CORS/`<img>`-only constraint, the RA
hours→degrees trap, and that SkyView signals errors *inside* a 200 GIF.
Update `CLAUDE.md`'s code-layout section with `src/lib/images/`.

## Risks / open questions for you

- **Framing factor 1.5× and the 5° clamp are my judgement calls**, not in the
  spec. If you want the frame to be exactly the object's size, say so and step 1
  drops the factor.
- **Third-party availability.** The app becomes partially dependent on a NASA
  CGI endpoint that is occasionally slow or down. The failure mode is contained
  (one collapsed block), but it is the first non-CDN external dependency.
- **`pixels=300`, fixed** — the user's cap, no `devicePixelRatio` scaling. The
  rendered box is capped to match, so the GIF is never upscaled; the payload and
  latency are well below the 512 px numbers measured above.
- Optional, not planned unless you want it: a "open full-size in a new tab" link,
  and a survey selector (`dss2r` vs `dss` vs infrared).
