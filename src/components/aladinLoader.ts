/**
 * Loads Aladin Lite from CDS's CDN and mounts a minimal, read-only sky view
 * into a given element.
 *
 * Lives in `src/components/`, not `src/lib/`: this is the one place in the
 * sky-view feature that touches `window`/`document`, and `src/lib/**` tests
 * run in bare Node with no DOM at all. `ObjectSkyView.svelte` depends on this
 * only through the injectable `loadAladin` prop, so tests never need a real
 * script fetch, WebGL, or network access.
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

export type AladinLoader = (
  el: HTMLElement,
  options: AladinViewOptions,
) => Promise<void>

interface AladinApi {
  init: Promise<void>
  aladin: (el: HTMLElement, options: Record<string, unknown>) => unknown
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
 * Every control and overlay is off on purpose: the widget is meant to read
 * as a static preview, not an explorable atlas. Aladin has no option to
 * disable panning/zooming/double-click-recenter themselves (verified against
 * the library's own event-wiring source — the listeners are attached
 * unconditionally), so that's done separately with `pointer-events: none` on
 * the container in ObjectSkyView.svelte.
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
): Promise<void> {
  if (!hasWebgl2()) {
    throw new Error('WebGL2 is not available')
  }

  const A = await loadScript()
  await withTimeout(A.init, 'Timed out initializing Aladin Lite')

  A.aladin(el, {
    ...MINIMAL_VIEWER_OPTIONS,
    target: options.target,
    fov: options.fov,
    survey: options.survey,
  })
}
