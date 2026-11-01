# Sky view backends: Aladin Lite and AAS WorldWide Telescope

**Status: implemented 2026-11-01** (phases 1–5; phase 6 verified for WWT only, since Aladin is down). See the findings box at the end.

Written 2026-11-01, after `aladin.cds.unistra.fr` went down. The framing assistant's sky view currently depends on Aladin Lite's script (`aladinLoader.ts`, `SCRIPT_URL`) and its HiPS tiles. This plan adds WorldWide Telescope (WWT) as a second backend and makes the choice a one-line source setting.

## 1. How the sky view uses Aladin today

`FramingAssistant.svelte` talks to the viewer only through the `loadAladin` prop. That prop returns an `AladinHandle` with four methods. The component needs nothing else from Aladin:

| Need | Aladin call | Where used |
|---|---|---|
| Mount a view at "RA Dec" (deg), fov (deg), survey | `A.aladin(el, opts)` | mount effect |
| Change the field of view in place (rig switch) | `setFov` | fov effect, Recenter |
| Undo a pan | `gotoRaDec` | Recenter button |
| Read the view centre | `getRaDec` | coordinate readout, seeded on load |
| Track the view centre while dragging | `on('positionChanged')` | coordinate readout |
| Drag to pan | built in | — |
| No zoom | not an option; wheel and pinch are blocked in the capture phase | `blockWheelZoom`, `blockPinchZoom` |
| No chrome | ~19 `show*: false` options | `MINIMAL_VIEWER_OPTIONS` |
| Survey | HiPS id `P/DSS2/color` | `aladin.ts` `DEFAULT_SURVEY` |

The camera-frame rectangle, the rotation slider and the Recenter and readout overlays are already plain SVG/DOM on top of the container. They don't depend on Aladin, so they carry over to any backend unchanged.

Other Aladin-specific code:
- `aladinLoader.ts` and `aladinLoader.test.ts`.
- `lib/images/aladin.ts`: the view maths is backend-neutral, but the `survey` value is an Aladin HiPS id.
- `src/visual/setup-visual.ts`: blocks `aladin.cds.unistra.fr`. It will need the WWT hosts blocked too.
- `HelpDialog.svelte`: credits.

## 2. Embedding WWT

WWT is the MIT-licensed `wwt-webgl-engine` (.NET Foundation, NumFOCUS sponsored). It was committed to as recently as 2026-10-23, and `@wwtelescope/engine` is at 7.41.0 on npm, last published 2026-10-09. There are three ways to embed it:

| Option | What it is | Verdict |
|---|---|---|
| **A. `@wwtelescope/engine` as a library** | Engine bundled from npm, or the prebuilt `https://web.wwtassets.org/engine/7/wwtsdk.js` (returns 200). Created with `WWTControl.initControl(...)` / `new WWTInstance(...)` from `@wwtelescope/engine-helpers`. | **Chosen.** Gives a real handle: goto, roll, getRA/getDec/zoom, `arrived` event. It also matches the existing `loadX(el, opts) → handle` shape. |
| B. `@wwtelescope/embed` iframe | A Vue app for iframes, built for `embed-creator` output. | Rejected. It ships its own chrome (zoom buttons, background picker). There is no documented URL API to set the centre, fov or hide controls, and there is no handle. |
| C. `research-app` iframe plus `postMessage` | `https://web.wwtassets.org/research/latest/` (200). It accepts `center_on_coordinates`, `modify_settings` (`hideAllChrome`) and similar messages. | Fallback only. The messages are fire-and-forget, so there is no way to read the pan position back for the readout. |

A prebuilt-script option (A with `wwtsdk.js` from `web.wwtassets.org`) mirrors how Aladin is loaded today (a CDN `<script>`, no bundle cost). Bundling `@wwtelescope/engine` from npm instead would avoid depending on that host, but it adds roughly a megabyte to the bundle. Decision for the spike: start with the CDN script, and bundle only if the CDN proves unreliable.

Relevant engine API (from `engine-pinia`/`engine-helpers` source):
- `gotoRADecZoom(raRad, decRad, zoomDeg, instant, rollRad?, duration?)`. **RA and Dec are in radians.** `zoomDeg` is documented as the final angular height of the viewport.
- `getRA()` returns hours, `getDec()` returns degrees.
- `ctl.renderContext.viewCamera.{zoom, rotation}` holds the live zoom and roll.
- `setBackgroundImageByName(name)`: a built-in imageset such as "Digitized Sky Survey (Color)". `loadImageCollection(wtmlUrl)` and `addImageSetLayer` load more.
- Rendering settings: `showConstellationFigures`, grid toggles and so on, all of which we turn off.
- Events: `ready`, `arrived`. There is no documented continuous "position changed" event.

## 3. What Aladin does that WWT cannot match, or must be verified

| Aladin feature | WWT | Impact |
|---|---|---|
| `P/DSS2/color` HiPS survey | The built-in "Digitized Sky Survey (Color)" imageset is a different tile set (STScI DSS, hosted by WWT). Arbitrary CDS HiPS can be used via a WTML collection, but those tiles live on CDS (`alasky`), which may be down too. | Image appearance and depth differ slightly. **The built-in set is the safe default**, because it doesn't touch CDS. Other surveys (2MASS, SFD, GALEX) are free extras. |
| `survey` as an HiPS id string | Imagesets are looked up by **name** | Needs a backend-neutral survey key (§4.2). |
| `positionChanged` event during drag | Not exposed | The live readout needs a per-frame poll of `getRA()`/`getDec()` (about 10 Hz via `requestAnimationFrame` while the pointer is down, plus on `arrived`). This is doable, but it is polling rather than an event. |
| Pan without zoom | No documented switch. Wheel/pinch are handled by the engine's own canvas listeners, much like Aladin's. | The existing capture-phase blockers should work, since they sit on an ancestor. **Verify in the spike.** WWT also pans differently, because a drag can tilt or roll (right-drag, Alt-drag). Those must be blocked or tolerated. |
| Pan direction and orientation | WWT's default sky view is north-up, east-left, like Aladin, but this must be checked. | `screenRotationDeg = -rotation` is pinned by a test. Re-verify the sign against the real viewer. |
| Fov definition | `zoomDeg` is the viewport **height**. Aladin's `fov` for a square box is the box side. WWT's internal zoom has a historical 6× factor, so the number may not be the visible span. | The camera-frame rectangle is a fraction of the box, so a scale error makes it lie. Calibrate against a known pair of stars or a known object. **Highest-risk item.** |
| "Hide all chrome" | The engine itself has no chrome (the toolbar belongs to the embed/research apps). It may still draw a crosshair or an FPS overlay, so set `showCrosshairs`/`showConstellationFigures` etc. to false. | Low. |
| WebGL | Needs WebGL (2 preferred), like Aladin | Same `hasWebgl2` check, possibly relaxed to WebGL1. |
| Load-failure event | None documented (same as Aladin) | Same script-load + init timeout approach. |
| Roll | `gotoRADecZoom` accepts `rollRad` and the engine supports view roll | **A bonus.** The slider could roll the sky and keep the rectangle axis-aligned. This is out of scope for the first version; the rectangle stays an SVG overlay for parity. |

Net: **nothing is blocked outright.** The two real risks are the fov calibration and the survey difference. The readout and zoom locking each need small workarounds.

## 4. Design: a viewer abstraction behind one config setting

### 4.1 The setting

New file `src/config.ts`:

```ts
export type SkyViewBackend = 'aladin' | 'wwt'
/** Which engine draws the framing assistant's sky view. Change here, rebuild. */
export const SKY_VIEW_BACKEND: SkyViewBackend = 'wwt'
```

A source constant, not a runtime or UI setting, as requested. A bundler dead-code-eliminates the unused branch, so the unused backend's loader never loads.

### 4.2 Backend-neutral types (`src/components/skyView.ts`, new)

- `SkyViewHandle` is the current `AladinHandle` renamed: `setFov`, `gotoRaDec`, `getRaDec`, `on('positionChanged')`. WWT's handle implements the same four methods, with the polling inside it. `FramingAssistant` therefore needs **no logic change**, only type renames.
- `SkyViewLoader = (el, { target, fov, survey }) => Promise<SkyViewHandle>`.
- `getSkyViewLoader(backend = SKY_VIEW_BACKEND): SkyViewLoader` picks `loadAladinView` or `loadWwtView`.
- `survey` becomes a backend-neutral key: `'dss-color'` (default), plus optional `'2mass'`, `'galex'` and so on. Each loader owns a small table mapping the key to an Aladin HiPS id or a WWT imageset name. `lib/images/aladin.ts` is renamed `view.ts` (or keeps its name with a re-export), and `DEFAULT_SURVEY` becomes `'dss-color'`. This is the only change outside `components/`. Behaviour of the view maths is unchanged.

### 4.3 `wwtLoader.ts` (new, mirrors `aladinLoader.ts`)

- Injects the `wwtsdk.js` script (cached promise, 15 s timeout, cache cleared on failure, same pattern).
- Mounts into `el`, waits for `ready`, applies settings (hide crosshairs/figures/grids), sets the background imageset, then `gotoRADecZoom(raRad, decRad, zoomDeg, instant = true)`.
- Converts at the boundary: target string degrees → radians; `fov` → WWT `zoomDeg` through one named function (`fovToWwtZoom`) so the calibration lives in one place.
- Handle: `setFov` → `gotoRADecZoom` at the current centre. `gotoRaDec` is the same with the current zoom. `getRaDec` is `[getRA() × 15, getDec()]`. `on('positionChanged')` starts a polling loop on pointer-down and stops it on pointer-up, firing only when the position actually changed.
- Destroys the engine's render loop when the container goes away. WWT is a global singleton per page, which Aladin is not. **Check whether two instances are possible** (relevant to the `{#key}` remount on Retry or an object change).

### 4.4 Wiring

- `FramingAssistant.svelte`: default `loadAladin` prop renamed `loadSkyView`, defaulting to `getSkyViewLoader()`. Type renames only.
- `ResultsPanel.svelte`: no change expected.
- `HelpDialog.svelte`: credit the active backend (Aladin Lite / CDS, or WorldWide Telescope / AAS WWT, MIT, DSS).
- `setup-visual.ts`: also block `web.wwtassets.org`. Visual tests keep injecting a fake loader, so no real viewer is loaded.

## 5. Phases

Each phase leaves `npm test`, `npm run check` and `npm run lint` green.

1. **Spike (go/no-go, no repo changes).** In a scratch HTML page: load `wwtsdk.js`, show DSS colour at M31, and test the unknowns: (a) `zoomDeg` versus true visible span, using two known stars; (b) whether wheel/pinch blocking on an ancestor works, and what right-drag/Alt-drag do; (c) sky orientation, so the rotation sign is right; (d) two instances on one page or destroy/recreate; (e) which settings remove all overlay clutter; (f) does the built-in DSS imagery load with CDS blocked. **If (a) or (b) fail, fall back to option C or stay with Aladin only.**
2. **Extract the abstraction.** Rename `AladinHandle`/`AladinLoader`/`loadAladin` to the neutral names, add `config.ts` and `getSkyViewLoader` (Aladin only for now), and introduce survey keys with the Aladin id table. Pure refactor; existing tests updated mechanically. Nothing changes for users.
3. **WWT loader.** `wwtLoader.ts` plus `wwtLoader.test.ts` (fake `window` engine, covering script load, timeout, unit conversion, the polling handle and cache reset on failure). Add the `'wwt'` branch to `getSkyViewLoader`.
4. **Calibration test.** A visual-project test that renders against a fake loader can't prove the fov maths, so add a unit test pinning `fovToWwtZoom` to the number measured in the spike, plus a manual check (M31 with a known rig should put the rectangle on the same stars as in Aladin).
5. **Docs and credits.** Update `HelpDialog.svelte`, `CLAUDE.md` (the sky-view paragraphs), `.plan/framing-assistant-plan.md`, and `.plan/state.md` (phase row and dated log entry).
6. **Verify both.** Flip `SKY_VIEW_BACKEND` each way and check in a real browser: load, pan, no zoom, Recenter, readout, rig switch, rotation, Retry, collapse and reopen.

## 6. Risks and open questions

- **Fov calibration (§3).** If the rectangle is wrong the whole feature is misleading. Test with real stars before shipping WWT as default.
- **Singleton engine.** If WWT can't be torn down cleanly, the `{#key}` remount may need to reuse one instance and retarget it with `gotoRADecZoom`, which is actually simpler than Aladin's case.
- **Does the CDN host stay up?** `web.wwtassets.org` is an Azure blob host run by the WWT team. If we want independence from it, bundle `@wwtelescope/engine` and self-host the imagery config.
- **Bundle size** if the engine is bundled rather than script-loaded.
- **Default backend.** Aladin is down now, so the plan assumes the default flips to `'wwt'` once phase 6 passes. Say if you would rather keep `'aladin'` as default and flip it only during outages.
- **API-doc gaps.** The public API reference didn't document `gotoRADecZoom` units or zoom locking. The details above come from the `engine-pinia` source, so treat anything not marked verified as provisional until the spike.

## 7. Sources

- WWT engine repo: https://github.com/WorldWideTelescope/wwt-webgl-engine (README, `engine-pinia/src/store.ts`, `engine-helpers/src/engine.ts`, `embed/src/Embed.vue`, `research-app-messages/src/settings.ts`)
- API reference: https://docs.worldwidetelescope.org/webgl-reference/latest/
- npm: https://npmjs.com/package/@wwtelescope/engine, https://npmjs.com/package/@wwtelescope/embed

## 8. Implementation findings (2026-11-01)

- **Fov calibration (the top risk) resolved.** `ScriptInterface.gotoRaDecZoom(raDeg, decDeg, zoom, …)` multiplies zoom by 6 internally and takes RA in degrees; `zoom` is the viewport height in degrees, so our `fov` passes through unchanged. In a real browser M31 at a 4.4° field shows M32/M110 where expected, and a 100 px drag moved the centre by the amount the 4.4° box predicts (RA and Dec both). The `-rotation` sign for the frame has **not** been re-checked against a rig frame in the real viewer: orientation is north-up/east-left like Aladin, so it should hold.
- **Verified in Chrome (localhost):** load, DSS imagery, drag-pan, live readout (polling), Recenter, wheel scroll and `z` key do not zoom.
- **Not verified:** HTTPS deployment. The built-in DSS imageset URL in `builtin-image-sets.wtml` is `http://cdn.worldwidetelescope.org/...`; the `https://` form returns 200 with CORS `*`, but whether the engine upgrades it on an https page (mixed content) was not tested — localhost can't show it. **Check on skypath.voronin.cc after deploy.**
- **Singleton resolved by design:** later mounts re-parent the one canvas rather than re-initialising.
- **Spike items (b) and (e):** only plain left-drag reaches the engine; settings that hide crosshairs/figures/grids are applied by name and skipped if absent.
- **Known gap:** WWT binds `keydown` on `document.body`; the `z` key did nothing in testing, but other zoom keys were not exercised.
- Aladin remains selectable (`SKY_VIEW_BACKEND = 'aladin'`) and is unit-tested, but was not run against the live service.
