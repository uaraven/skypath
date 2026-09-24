# Implementation plan — framing assistant

Plan for [framing assistant.md](framing%20assistant.md). Two features that
arrive together: a second managed collection (**rigs** = telescope + camera)
in the left sidebar, and a **framing assistant** that replaces the Results
tab's sky-view block with the same Aladin view plus a camera-frame rectangle
and a rotation slider.

## Goal restated

1. The left bar becomes two lists: **Observatories** and **Rigs**, each with
   its own add / edit / delete footer. The overflow (hamburger) menu leaves
   `ObservatoryManager` and becomes **one menu for the whole sidebar**,
   exporting and importing both collections in a single file.
2. `ObjectSkyView` becomes `FramingAssistant`: same collapsible Aladin block,
   but the field of view is 25 % wider than **the selected rig's own field**
   (revised 2026-09-23 — see decision 8), a **rectangle** marks what the
   camera sees, and a **0–360° slider** under the view rotates it.
3. The rig add/edit dialog computes and shows, live: image scale (″/px),
   telescope diffraction limit, and the field of view in both axes.

Everything stays client-side: rigs are another `localStorage` collection,
same shape of store as observatories.

## What I'm reusing vs. building new

The observatory feature already contains the entire pattern this needs — a
versioned single-key store with a Svelte-store `subscribe`, a list component
that owns selection and dialogs, a validated-draft editor modal, and a
lenient JSON import. `RigStore` / `RigManager` / `RigEditor` are that pattern
a second time, not a new one; the plan below only calls out where rigs
deliberately *differ* (chiefly: the rig list is allowed to be empty).

The astronomy layer is untouched. Framing is optics, not ephemeris — focal
length, sensor size and pixel pitch — and it lives in its own pure module
next to `aladin.ts`, which already computes "where does the view point and
how wide."

## Design decisions

### 1. The rig data model: one canonical camera form

```ts
// src/lib/rig/types.ts
export interface Telescope {
  /** mm. */
  focalLength: number
  /** mm; optional — only the f-ratio and diffraction limit need it. */
  aperture?: number
}

export interface Camera {
  /** Set when picked from the built-in list, so the editor can show which. */
  sensorId?: string
  pixelsX: number
  pixelsY: number
  /** µm. Square pixels are the norm, but both axes are stored. */
  pitchX: number
  pitchY: number
}

export interface Rig {
  id: string
  name: string
  telescope: Telescope
  camera: Camera
}

export type RigInput = Omit<Rig, 'id'>
export function isRig(value: unknown): value is Rig // mirrors isObservatory
```

The spec allows a camera to be entered **either** as sensor mm + resolution
**or** as pixel pitch + resolution. Those are the same fact twice
(`mm = px × µm ÷ 1000`), so only one is stored: **resolution + pitch**. That
is also the form the sensor table is quoted in, and the form that survives
rounding — every listed sensor's mm figures reproduce from px × pitch to
within 1 % (IMX455: 9576 × 3.76 µm = 36.01 mm; IMX183 is the loosest at
13.31 vs a quoted 13.2).

The editor shows **both** rows, live-linked: typing a sensor width in mm
rewrites the pitch and vice versa, so neither entry style is a mode the user
has to pick first.

### 2. The built-in sensor list is data, not a store

`src/lib/rig/sensors.ts` holds the twelve chips from the spec as a frozen
array (`id`, `name`, `pixelsX/Y`, `pitchX/Y`). The editor's dropdown seeds
the camera fields from a pick; every field stays editable afterwards, and
editing one clears nothing — `sensorId` is kept purely so the dropdown can
show "Sony IMX571" again on reopen. "Custom" is the absence of `sensorId`.

Its test asserts the derived sensor sizes land within 2 % of the millimetre
figures quoted in the spec — that is the only check that catches a typo in a
table of twelve four-digit numbers.

### 3. Optics: `src/lib/rig/optics.ts`, pure, one entry point

```ts
export interface RigOptics {
  sensorWidthMm: number
  sensorHeightMm: number
  arcsecPerPixelX: number
  arcsecPerPixelY: number
  fovWidthDeg: number
  fovHeightDeg: number
  /** Null when the telescope has no aperture entered. */
  focalRatio: number | null
  diffractionArcsec: number | null
}

export function rigOptics(rig: Rig): RigOptics
```

- image scale: `206.265 × pitch_µm / focal_mm` ″/px
- field of view: `2·atan(sensor_mm / (2·focal_mm))`, **not** the small-angle
  form — a full-frame sensor on a short lens is a 10°+ field and the
  small-angle version is visibly wrong there, while the exact form costs
  nothing
- f-ratio: `focal / aperture`
- diffraction: **Dawes' limit, `116 / aperture_mm` ″** — the line amateur
  framing calculators quote, and what the readout is labelled ("Dawes limit",
  not a bare "diffraction limit", because Rayleigh's `138/D` is the other
  answer to the same question and the two differ by 19 %)

Pinned by worked examples in the test: IMX571 (3.76 µm, 6252 × 4176) on a
530 mm scope → 1.463 ″/px, 2.541° × 1.699°; a 130 mm aperture → f/4.08 and a
0.892 ″ Dawes limit.

### 4. `RigStore` mirrors `ObservatoryStore`, minus the never-empty invariant

`src/lib/rig/store.ts`, key **`skypath.rigs.v1`**, schema version 1, same
`subscribe` contract, same `create` / `update` / `remove` / `select` /
`reorder` / `importRigs(incoming, mode)` surface, same "corrupt JSON falls
back to empty rather than breaking boot" read path.

The one deliberate divergence: **the list may be empty and `selectedId` may
be `null`** (`selected: Rig | null`). Observatories can't be empty because
every calculation needs a location; nothing in the app needs a rig, and
inventing a plausible default telescope would be inventing a fact about the
user's equipment. First run therefore shows an empty rig list and the sky
view behaves exactly as it does today (object-sized field, no rectangle).

### 5. Export/import moves up to a sidebar-level module

New `src/lib/transfer/` (`backup.ts` + `index.ts`), which depends on both
domains — neither `lib/observatory` nor `lib/rig` should import the other:

```ts
export const BACKUP_VERSION = 2

export interface BackupFile {
  app: 'skypath'
  kind: 'backup'
  version: number
  exportedAt: string
  observatories: Observatory[]
  rigs: Rig[]
}

export interface BackupImport {
  observatories: Observatory[]
  rigs: Rig[]
  invalidObservatories: number
  invalidRigs: number
  error?: string
}

export function serializeBackup(observatories: Observatory[], rigs: Rig[]): string
export function parseBackup(text: string): BackupImport
```

`parseBackup` reuses `parseObservatoryImport`'s lenient container handling
(bare array, `{observatories}`, or our envelope) so **v1 observatory-only
files still import**, yielding `rigs: []`. `observatory/transfer.ts` stays as
the observatory half and keeps its exports; only the file name the download
gets changes, `skypath-observatories-<date>.json` →
`skypath-settings-<date>.json` (date as `yyyy-dd-mm`, per the user). `selectedId`
is still not exported, for both collections, for the reason already written
into `transfer.ts`: highlight is a property of the browser, not the
collection.

### 6. The import dialog gains a *what* alongside its *how*

`ObservatoryImportDialog` → **`ImportDialog.svelte`**, with two checkboxes
above the existing Append / Overwrite buttons:

```
☑ Observatories (4)          ☑ Rigs (2)
[ Cancel ]  [ Append ]  [ Overwrite ]
```

A checkbox for a kind the file doesn't contain is unchecked and disabled;
both unchecked disables Append and Overwrite. The mode applies to each
checked collection independently, which is exactly what the spec asks
("replace/append applies to selected element"). Callback shape:

```ts
onimport: (
  mode: 'append' | 'overwrite',
  include: { observatories: boolean; rigs: boolean },
) => void
```

### 7. Sidebar shell: a new component, not a bigger `ObservatoryManager`

`src/components/Sidebar.svelte` renders `<ObservatoryManager>` +
`<RigManager>` and owns the shared parts: the hamburger menu, the hidden file
input, the export download and the import dialog — all of which move out of
`ObservatoryManager` unchanged in behaviour. `App.svelte` renders `<Sidebar>`
where it rendered `<ObservatoryManager>`, and its
`main > :global(.observatories)` scroll rule retargets to `.sidebar`.

The menu button sits in its own right-aligned row at the **bottom of the
sidebar**, under both panels, so it reads as belonging to both rather than to
whichever list it happens to sit inside.

`RigManager` takes an optional `store?: RigStore` prop, the same injection
seam `ObservatoryManager` already exposes for tests. Selection, double-click
to edit, and drag-to-reorder all behave identically; the delete confirmation
text is the only copy that differs (no "a default will take its place"
clause — deleting the last rig leaves none).

### 8. The frame is drawn as an SVG layer over Aladin, not as an Aladin overlay

The spec points at Aladin's overlay API, and it can do this
(`A.graphicOverlay({color})` + `aladin.addOverlay(overlay)` +
`A.polyline([[ra,dec], …])`). I'm proposing an absolutely-positioned inline
SVG over the Aladin container instead, for three reasons:

- **The rotation slider re-draws on every tick.** The documented API has no
  per-shape removal — only `aladin.removeLayers()`, which wipes every
  graphical layer — so each tick would tear down and rebuild the overlay
  through an undocumented-lifetime object. An SVG rectangle with a
  `transform` is one attribute write.
- **It stays testable in jsdom.** The rectangle's geometry is then real DOM
  the component tests can assert, rather than state inside Aladin's canvas
  that only a screenshot can see.
- **The view is already static.** `pointer-events: none` on the container
  (there since the Aladin switch — Aladin can't disable its own pan/zoom
  listeners) means the projection under the SVG never moves, which is the
  one thing that would desync a pixel-space overlay.

The cost is that the rectangle is drawn in the tangent plane rather than
projected: at the ≤ 5° fields in play, the gnomonic distortion across the
frame is under ~0.2 %, i.e. sub-pixel.

**Update, 2026-09-23**: the view did become pannable (Aladin's own
mouse/touch drag handling, previously suppressed with `pointer-events: none`
on the container), but this decision did **not** flip to `A.polyline`. Asked
the user how the rectangle should behave under panning, and the answer was:
stay put in screen space, don't track the sky. That's a feature, not a
compromise — it lets the rectangle be used to *reframe* a shot (pan the
target off-centre and see what still falls inside the sensor) rather than
only ever showing it centred, and it means the SVG-overlay approach above
still holds with no reprojection work. A **Recenter** button (bullseye icon,
top-right of the view) calls the loader handle's `gotoRaDec`/`setFov` to
return to the object-centred view the panel originally computed.

**Follow-up, same day**: zoom was cut back out — the user pointed out it
"doesn't mesh with static rectangle" (a changed scale, unlike a changed
centre, would make the fixed-fraction rectangle lie about the field it
represents). Aladin has no option to disable zoom input on its own, so
`FramingAssistant.svelte` intercepts wheel and multi-touch (2+ point) events
in the capture phase on the container — an ancestor of the canvas Aladin
binds its own listeners to — and calls `stopPropagation()` before they ever
reach it, while single-touch/mouse drags pass through untouched. Also added:
a coordinate readout (bottom-left of the view) showing the current view
centre, via two more real, verified Aladin methods on the handle —
`getRaDec()` (seeded once on load) and `on('positionChanged', callback)`
(kept live as the user drags, firing `{ra, dec, dragging}` in degrees).

Geometry lives in `src/lib/images/framing.ts`, pure and unit-tested:

```ts
export const FRAME_MARGIN = 1.1

export interface FramingView {
  target: string
  survey: string
  /** Degrees across the (square) view box. */
  fov: number
  /** Fractions of the view box, 0–1. Null when no rig is selected. */
  frame: { width: number; height: number } | null
}

export function framingViewParams(
  object: DeepSkyObject,
  rig: Rig | null,
  options?: AladinOptions,
): FramingView
```

With a rig:

```
rigDiagonal = hypot(rig.fovWidthDeg, rig.fovHeightDeg)
fov = clamp(FRAME_MARGIN × rigDiagonal)
```

**Revised 2026-09-23**: the view is sized off the *rig alone*, never the
object. The original decision (below, struck through) sized the view to
whichever was larger — the rig's field or the object's catalogue size — so a
long focal length on a big, diffuse target (e.g. a degree-scale emission
nebula) would balloon the view out to fit the whole object, shrinking the
camera-frame rectangle to a near-invisible sliver. In real use that read as
"the view doesn't change when I switch rigs" for any rig narrower than the
object, and as "too small a view" for the frame itself — the opposite of
what the panel is for, which is showing what *this* rig, at its own zoom,
will actually capture. Dropping the object side of the `max` means switching
rigs always changes the view, and the frame rectangle is always a consistent
fraction of the box's diagonal (decision 8, second half, still applies).
`FRAME_MARGIN` itself was tightened from 1.25 to 1.1 the same day, per an
explicit request, once the rig-only sizing made the margin's effect on the
rectangle's on-screen size directly visible — less breathing room around the
frame, so `1/FRAME_MARGIN ≈ 91%` of the box's diagonal rather than 80%.

~~where `objectDeg` is the object's major axis (the catalogue size in arcmin
÷ 60, or the existing 30′ fallback). **The larger of the rig and the target
sets the scale**: a widefield rig on M13 shows the rig's field with a small
cluster inside it, and a long focal length on M31 shows the whole galaxy with
the sensor's rectangle cropping a corner of it — which is exactly the
question the panel is there to answer.~~ The frame fractions are each rig
axis' FOV over `fov`.

**The rig side of the `max` uses its diagonal, not its larger axis** — found
after shipping, from a screenshot where a near-square sensor's frame,
rotated toward 45°, poked past the corners of the view. Sizing off the
larger *unrotated* axis only guarantees the frame fits at rotation 0°; the
slider spins the rectangle about the box's centre, and at the worst angle a
rectangle reaches out to its own diagonal in every direction. Using the
diagonal here is what keeps the frame inside the box at *every* rotation,
not just the default one — the cost is that the rectangle fills
`1/FRAME_MARGIN` of the box's diagonal (≈91% at the current 1.1 margin)
rather than the full side, so it reads a little smaller unrotated than a
larger-axis sizing would.

Without a rig: today's `fieldOfViewDegrees(object.size)` and `frame: null`,
so the block degrades to exactly the current sky view. Note that path keeps
its existing `FRAMING_FACTOR` of 1.5 while the framing path uses `FRAME_MARGIN` (1.1) — the
two numbers answer different questions (breathing room around a target vs.
the spec's margin around a sensor field) and collapsing them would change
today's sky view for no reason.

The existing `MIN_FIELD_DEGREES` / `MAX_FIELD_DEGREES` clamp still applies to
the *view*, which means a very wide rig (a camera lens) will clamp at 5° and
the rectangle will overflow the box — the frame fractions are computed
**before** the clamp and then clipped by the SVG viewport, which is the
honest rendering of "your field is wider than this view."

### 9. Rotation convention, and the sign that will be wrong if nobody writes it down

The slider is a **position angle: the camera frame's vertical axis, measured
from north through east, 0–360°**, matching how NINA and PixInsight talk
about rotation. Aladin's default orientation is north up, **east left**, so
increasing PA runs counter-clockwise on screen while SVG/CSS `rotate()` is
clockwise-positive:

```
screenRotationDeg = -positionAngleDeg
```

A test pins it: at PA 90° the frame's "top" edge points to screen **left**.
This is the one piece of the feature that is silently, plausibly wrong in the
mirror image if it's guessed.

### 10. `FramingAssistant` replaces `ObjectSkyView`, and the loader returns a handle

`ObjectSkyView.svelte` → `FramingAssistant.svelte`, keeping the collapsible
disclosure, the mount-only-while-open rule, the spinner/failed/Retry states
and the injectable `loadAladin` prop. Added: the SVG frame layer, the
rotation slider row (hidden when there is no rig), and a caption that reads
`2.54° × 1.70° · 1.46″/px` for the selected rig instead of today's
`45′ field`.

One change to `aladinLoader.ts`: `AladinLoader` resolves to a small handle
instead of `void`.

```ts
export interface AladinHandle {
  setFov(degrees: number): void
}
export type AladinLoader = (el, options) => Promise<AladinHandle>
```

Switching rigs changes only the fov, and remounting for that would re-fetch
tiles and flash the panel; `aladin.setFov(deg)` is documented and does it in
place. So the `{#key}` remount narrows to `target | survey | attempt`, and a
second `$effect` pushes fov changes through the handle. Test fakes resolve to
`{ setFov: vi.fn() }`.

The view box grows from a flat 300 px to **half the panel's width, floored at
400 px** — 300 px was sized for a thumbnail, and a framing decision is the
thing the panel is now for. In CSS that is

```css
width: min(100%, max(400px, 50%));
```

The outer `min(100%, …)` is what keeps the floor from overflowing on a phone,
where the panel itself is narrower than 400 px. The box stays square (the fov
is one number across a square view), so the height follows via
`aspect-ratio: 1`.

### 11. Where the rotation is remembered

In the **session store**, as `frameRotation: number`, read tolerantly and
**without bumping `SCHEMA_VERSION`** — the same additive-field precedent
`imageOpen` set, and for the same reason (bumping would orphan every saved
object and night over one new field). **One value for all rigs and all
objects** (confirmed): it is view state like the scrub position, not a
property of the equipment, so it neither multiplies per rig nor travels in
the export file.

`App.svelte` gains the selected rig (from the rig store, same `$derived`
shape as `selectedObservatory`) and passes it to `ResultsPanel`, which builds
the `FramingView` and hands the component ready-made values — the existing
division of labour, where the panel computes and the view renders.

## Files

**New**

| Path | Purpose |
| --- | --- |
| `src/lib/rig/types.ts` | `Rig`, `Telescope`, `Camera`, `isRig` |
| `src/lib/rig/sensors.ts` | the 12 built-in sensors |
| `src/lib/rig/optics.ts` | `rigOptics` — scale, FOV, f-ratio, diffraction |
| `src/lib/rig/store.ts` | `RigStore`, `rigs` singleton, `skypath.rigs.v1` |
| `src/lib/rig/index.ts` | public API |
| `src/lib/transfer/backup.ts` | `serializeBackup` / `parseBackup` |
| `src/lib/transfer/index.ts` | public API |
| `src/lib/images/framing.ts` | `framingViewParams`, `FRAME_MARGIN` |
| `src/components/Sidebar.svelte` | both lists + the shared data menu |
| `src/components/RigManager.svelte` | rig list + add/edit/delete |
| `src/components/RigEditor.svelte` | the rig dialog with live readouts |
| `src/components/FramingAssistant.svelte` | ex-`ObjectSkyView`, plus frame and slider |

**Changed** — `ObservatoryManager.svelte` (menu/import/export removed),
`ObservatoryImportDialog.svelte` → `ImportDialog.svelte` (kind checkboxes),
`aladinLoader.ts` (handle), `ResultsPanel.svelte` (rig prop, framing params),
`App.svelte` (sidebar, rig store, rotation), `session/store.ts`
(`frameRotation`), `lib/images/index.ts`, `Icon.svelte` (a rig/telescope
glyph), `setup-visual.ts` (renamed block).

**Deleted** — `ObjectSkyView.svelte` and its tests (renamed, not dropped).

## Phases

Each is independently shippable and leaves the suite green.

1. **Rig domain.** `types` / `sensors` / `optics` / `store` / `index`, unit
   tests only, nothing wired into the UI.
   *Done when* `rigOptics` matches the worked examples, the sensor table
   derives the spec's millimetres within 2 %, and `RigStore` passes the
   observatory store's test list adapted for an empty-allowed collection.
2. **Sidebar.** `RigManager`, `RigEditor`, `Sidebar`; `ObservatoryManager`
   loses the menu; `App` retargets. Export still writes the v1 observatory
   file at this point.
   *Done when* rigs can be added, edited, deleted, reordered and selected,
   the editor's readouts update as you type, and every existing
   `ObservatoryManager` test still passes (the import/export cases having
   moved to `Sidebar.test.ts`).
3. **Combined transfer.** `lib/transfer`, `ImportDialog`, wiring.
   *Done when* a v2 file round-trips both collections byte-for-byte, a v1
   observatory file still imports, and each checkbox × mode combination does
   only what it says.
4. **Framing assistant.** `framing.ts`, the loader handle, `FramingAssistant`,
   `ResultsPanel` / `App` / session wiring.
   *Done when* selecting a rig sizes the view and draws the rectangle,
   switching rigs re-fovs without a remount, the slider rotates the frame the
   right way round, and no rig selected renders today's sky view exactly.
5. **Docs and visual tests.** `CLAUDE.md`, `.plan/state.md` log entry,
   `HelpDialog` (what a rig is and that the frame is a preview, not a plate
   solve), visual test renamed and extended with a frame-geometry assertion.

## Tests

- **Unit** — `optics.test.ts` (worked examples above; absent aperture yields
  `null` f-ratio and diffraction, not `Infinity`/`NaN`); `sensors.test.ts`
  (derived mm vs the spec's table, unique ids); `store.test.ts` (the
  observatory store's cases, plus: an empty list is a legal persisted state,
  deleting the last rig leaves `selectedId: null`, a stored rig failing
  `isRig` is dropped not fatal); `backup.test.ts` (round trip, v1 file,
  garbage, one collection empty, `selectedId` absent from the output);
  `framing.test.ts` (fov = `FRAME_MARGIN` × the selected rig's own diagonal,
  independent of object size; fractions, no-rig fallback, wide-rig clamp
  overflow, the PA→screen sign).
- **Components** — `RigEditor.test.ts` (picking a sensor fills the fields;
  editing mm rewrites pitch and back; validation rejects a zero focal length;
  Cancel writes nothing to the store); `RigManager.test.ts` (list, selection,
  delete copy with one and with none left); `Sidebar.test.ts` (menu, export
  filename and payload, import dialog hand-off); `ImportDialog.test.ts` (the
  checkbox matrix); `FramingAssistant.test.ts` (ex-`ObjectSkyView` suite with
  handle-returning fakes, plus: rectangle present with a rig and absent
  without, slider updates the transform, fov change calls `setFov` and does
  **not** re-invoke the loader); `ResultsPanel.test.ts` (rig-driven caption).
- **Visual** — `src/visual/framing.test.ts` (ex-`object-sky-view.test.ts`,
  fake loader painting synthetic DOM as today): for a rig whose field is
  larger than the target, the rectangle's measured pixel size is 1/1.25 of
  the box on its diagonal, a 90° rotation lands where decision 9 says, and —
  the regression a real screenshot caught — a square-ish rig's frame stays
  inside the box at 45° too, not just at 0°. `setup-visual.ts` keeps the
  block collapsed for every other test — the browser there is real and
  Aladin's CDN must stay out of the suite.

Rough count: ~60 new tests on top of the current 581.

## Resolved questions

Answered 2026-09-22; recorded here because the reasoning is not recoverable
from the code these turn into.

1. **What sizes the view** — the **selected** rig's own field × `FRAME_MARGIN`
   (decision 8). Not "the largest rig in the list", which was the other
   reading of the spec's sentence. Originally the larger of the rig and the
   object; revised 2026-09-23 to the rig alone (decision 8).
2. **No rigs** — empty list, no rectangle, today's object-sized view
   (decision 4). No fabricated default rig.
3. **Diffraction** — **Dawes**, `116/D` (decision 3).
4. **Rotation** — one value shared across all rigs and objects, in the
   session store (decision 11).
5. **View box** — 50 % of the panel width, floor 400 px (decision 10).

Two notes on the spec: "iframe" in the document is the
framed view box, not an `<iframe>` element — the Aladin view has been a
mounted `<div>` since the SkyView replacement; and the framing assistant is
**deep-sky only**, inheriting the existing rule that a planet or the Moon
gets no sky view at all (a fixed cutout of the stars it's crossing tonight
shows everything except the target).
