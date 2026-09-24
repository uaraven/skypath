/**
 * Loads Aladin Lite from CDS's CDN and mounts a minimal, pannable sky view
 * into a given element.
 *
 * Lives in `src/components/`, not `src/lib/`: this is the one place in the
 * sky-view feature that touches `window`/`document`, and `src/lib/**` tests
 * run in bare Node with no DOM at all. `FramingAssistant.svelte` depends on
 * this only through the injectable `loadAladin` prop, so tests never need a
 * real script fetch, WebGL, or network access.
 *
 * There is no documented tile-load-failure event for Aladin Lite (unlike
 * SkyView, which always answered 200 and baked its own errors into the
 * pixels) — "ready" here means the script loaded, `A.init` settled, and
 * `A.aladin()` did not throw. Actual tile painting happens inside Aladin's
 * own canvas, outside this module's visibility.
 */

const SCRIPT_URL =
  'https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js'

const LOAD_TIMEOUT_MS = 15000

export interface AladinViewOptions {
  /** "RA Dec" in decimal degrees. */
  target: string
  /** Field of view, in degrees. */
  fov: number
  /** HiPS survey id. */
  survey: string
}

/**
 * The slice of a live Aladin instance the app drives after mounting it.
 * Returning this rather than `void` is what lets the framing assistant
 * change the field of view on a rig switch via the documented `setFov` API
 * instead of tearing down and remounting the whole viewer (which would
 * re-fetch tiles and flash the panel).
 */
export interface AladinHandle {
  setFov(degrees: number): void
  /** RA/Dec in decimal degrees. Used by the framing assistant's Recenter
   *  button to undo a user pan without remounting the view. */
  gotoRaDec(ra: number, dec: number): void
  /** `[ra, dec]` in decimal degrees, ICRS, of the current view centre. */
  getRaDec(): number[]
  /** Only `'positionChanged'` is used — fired (including on a plain pan, not
   *  just a drag) with the new view centre, which is what drives the
   *  coordinate readout below the view. */
  on(
    event: 'positionChanged',
    callback: (position: { ra: number; dec: number }) => void,
  ): void
}

export type AladinLoader = (
  el: HTMLElement,
  options: AladinViewOptions,
) => Promise<AladinHandle>

interface AladinApi {
  init: Promise<void>
  aladin: (el: HTMLElement, options: Record<string, unknown>) => AladinHandle
}

declare global {
  interface Window {
    A?: AladinApi
  }
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), LOAD_TIMEOUT_MS)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function hasWebgl2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

let scriptPromise: Promise<AladinApi> | null = null

function loadScript(): Promise<AladinApi> {
  if (!scriptPromise) {
    scriptPromise = withTimeout(
      new Promise<AladinApi>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = SCRIPT_URL
        script.charset = 'utf-8'
        script.onload = () => resolve(window.A!)
        script.onerror = () =>
          reject(new Error('Failed to load Aladin Lite script'))
        document.head.appendChild(script)
      }),
      'Timed out loading Aladin Lite',
    ).catch((error) => {
      // Clear the cache so a later Retry is a genuine second attempt rather
      // than staying rejected forever.
      scriptPromise = null
      throw error
    })
  }
  return scriptPromise
}

/**
 * Every chrome control is off — corner text, zoom buttons, the layer/share/
 * projection/coordinate-grid UI — so the widget reads as a clean sky view
 * rather than a full Aladin app shell. Panning and double-click recenter are
 * deliberately left enabled: FramingAssistant.svelte lets the user drag the
 * view to compose a shot, with its own Recenter button (via `gotoRaDec` +
 * `setFov` on the returned handle) to undo it. Zoom (scroll wheel, pinch) is
 * *not* left enabled — the camera-frame rectangle is a fixed fraction of the
 * view box, so a changed scale would silently make it lie about the field it
 * represents. Aladin has no option to disable zoom input itself (verified
 * against the library's own event-wiring source — the wheel/pinch listeners
 * are attached unconditionally to its canvas), so FramingAssistant.svelte
 * intercepts and stops those events in the capture phase before they reach
 * it, while leaving single-touch/mouse-drag panning untouched.
 */
const MINIMAL_VIEWER_OPTIONS = {
  cooFrame: 'ICRSd',
  showReticle: false,
  showZoomControl: false,
  showFullscreenControl: false,
  showLayersControl: false,
  showShareControl: false,
  showProjectionControl: false,
  showFrame: false,
  showFov: false,
  showCooLocation: false,
  showStatusBar: false,
  showContextMenu: false,
  showCooGridControl: false,
  showCooGrid: false,
  showSimbadPointerControl: false,
  showSettingsControl: false,
  showSelectionModeControl: false,
  showColorPickerControl: false,
  showCatalog: false,
}

export async function loadAladinView(
  el: HTMLElement,
  options: AladinViewOptions,
): Promise<AladinHandle> {
  if (!hasWebgl2()) {
    throw new Error('WebGL2 is not available')
  }

  const A = await loadScript()
  await withTimeout(A.init, 'Timed out initializing Aladin Lite')

  return A.aladin(el, {
    ...MINIMAL_VIEWER_OPTIONS,
    target: options.target,
    fov: options.fov,
    survey: options.survey,
  })
}
