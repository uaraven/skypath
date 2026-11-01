/**
 * Loads the AAS WorldWide Telescope WebGL engine and mounts a minimal,
 * pannable sky view into a given element — the `SkyViewLoader` counterpart of
 * `aladinLoader.ts`. See `.plan/wwt-sky-view-plan.md`.
 *
 * Lives in `src/components/` for the same reason as the Aladin loader: it
 * touches `window`/`document`, and `FramingAssistant.svelte` only reaches it
 * through the injectable `loadSkyView` prop, so tests never need the engine.
 *
 * Differences from Aladin that shape this file:
 * - The engine is a **page-wide singleton** (`WWTControl.initControl` builds
 *   one canvas and one global render context; a second call is a no-op). So
 *   the first mount creates the canvas and later mounts (Retry, a changed
 *   object) re-parent that same canvas into the fresh container and re-aim it.
 * - There is no `positionChanged` event. The handle polls `getRA`/`getDec`
 *   while the pointer is down and until the view stops drifting.
 * - `ScriptInterface.gotoRaDecZoom(raDeg, decDeg, zoom, …)` takes RA in
 *   **degrees**, and `zoom` is the viewport's angular **height** in degrees —
 *   which for our square box is the same number as Aladin's `fov`.
 *   `getRA()` answers in **hours**.
 */

import type { SkyViewHandle, SkyViewOptions } from './skyView'

const SCRIPT_URL = 'https://web.wwtassets.org/engine/7/wwtsdk.js'

/** The engine does not load its stock imagesets itself; this collection holds
 *  "Digitized Sky Survey (Color)" and the other all-sky sets. */
const IMAGESETS_URL =
  'https://web.wwtassets.org/engine/assets/builtin-image-sets.wtml'

/** The script is ~3 MB, so allow more than Aladin's 15 s. */
const LOAD_TIMEOUT_MS = 30000

/** Frames with an unchanged centre before the drag poll stops. */
const SETTLE_FRAMES = 30

/** Neutral survey key → WWT imageset name (matched case-insensitively as a
 *  substring by the engine). Unknown values pass through as names. */
const SURVEYS: Record<string, string> = {
  'dss-color': 'Digitized Sky Survey (Color)',
  '2mass': '2Mass: Imagery (Infrared)',
  galex: 'GALEX (Ultraviolet)',
}

interface WwtInterface {
  add_ready(callback: () => void): void
  add_collectionLoaded(callback: () => void): void
  endInit(): void
  loadImageCollection(url: string, loadChildFolders: boolean): void
  setBackgroundImageByName(name: string): void
  gotoRaDecZoom(
    raDeg: number,
    decDeg: number,
    zoomDeg: number,
    instant: boolean,
    rollRad?: number,
  ): void
  /** Hours. */
  getRA(): number
  /** Degrees. */
  getDec(): number
  settings: Record<string, unknown>
}

interface WwtApi {
  WWTControl: { initControl(divId: string): WwtInterface }
}

declare global {
  interface Window {
    wwtlib?: WwtApi
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

function hasWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

let scriptPromise: Promise<WwtApi> | null = null

function loadScript(): Promise<WwtApi> {
  if (!scriptPromise) {
    scriptPromise = withTimeout(
      new Promise<WwtApi>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = SCRIPT_URL
        script.charset = 'utf-8'
        script.onload = () => resolve(window.wwtlib!)
        script.onerror = () =>
          reject(new Error('Failed to load WorldWide Telescope script'))
        document.head.appendChild(script)
      }),
      'Timed out loading WorldWide Telescope',
    ).catch((error) => {
      // Clear the cache so a later Retry is a genuine second attempt.
      scriptPromise = null
      throw error
    })
  }
  return scriptPromise
}

/** Everything that should not be on a clean sky view. Looked up by name and
 *  skipped when missing, so a renamed setting degrades instead of throwing. */
const HIDDEN_SETTINGS = [
  'set_showCrosshairs',
  'set_showConstellationFigures',
  'set_showConstellationLabels',
  'set_showConstellationBoundries',
  'set_showGrid',
  'set_showEcliptic',
  'set_showEclipticOverviewText',
  'set_showSolarSystem',
  'set_showTouchControls',
]

function applyCleanSettings(wwt: WwtInterface): void {
  for (const setter of HIDDEN_SETTINGS) {
    const fn = (wwt.settings as Record<string, unknown>)[setter]
    if (typeof fn === 'function') fn.call(wwt.settings, false)
  }
}

/**
 * Only a plain left-button drag may reach the engine. Right-drag, and drags
 * with Ctrl/Alt/Shift held, tilt, roll or zoom the view — all of which would
 * make the fixed camera-frame rectangle lie, same reasoning as the wheel and
 * pinch blockers in `FramingAssistant.svelte`.
 */
function blockNonPanDrags(el: HTMLElement): void {
  el.addEventListener(
    'mousedown',
    (event) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey
      ) {
        event.stopPropagation()
      }
    },
    true,
  )
}

interface Shared {
  wwt: WwtInterface
  canvas: HTMLCanvasElement
}

let shared: Promise<Shared> | null = null
let nextId = 0

/** Creates the engine once; later calls hand back the same instance. */
function engine(el: HTMLElement): Promise<Shared> {
  if (!shared) {
    shared = withTimeout(
      (async () => {
        const api = await loadScript()
        if (!el.id) el.id = `wwt-view-${nextId++}`

        const wwt = api.WWTControl.initControl(el.id)
        const ready = new Promise<void>((resolve) =>
          wwt.add_ready(() => resolve()),
        )
        wwt.endInit()
        await ready

        const collection = new Promise<void>((resolve) =>
          wwt.add_collectionLoaded(() => resolve()),
        )
        wwt.loadImageCollection(IMAGESETS_URL, false)
        await collection

        applyCleanSettings(wwt)
        const canvas = el.querySelector('canvas')!
        // The engine sizes the canvas bitmap once, from the container; CSS
        // keeps it filling whichever container it is moved into next.
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.display = 'block'
        return { wwt, canvas }
      })(),
      'Timed out initializing WorldWide Telescope',
    ).catch((error) => {
      shared = null
      throw error
    })
  }
  return shared
}

export async function loadWwtView(
  el: HTMLElement,
  options: SkyViewOptions,
): Promise<SkyViewHandle> {
  if (!hasWebgl()) throw new Error('WebGL is not available')

  const { wwt, canvas } = await engine(el)
  if (canvas.parentElement !== el) el.appendChild(canvas)
  blockNonPanDrags(el)

  const [ra, dec] = options.target.split(' ').map(Number)
  let fov = options.fov
  wwt.setBackgroundImageByName(SURVEYS[options.survey] ?? options.survey)
  wwt.gotoRaDecZoom(ra, dec, fov, true, 0)

  const centre = (): [number, number] => [wwt.getRA() * 15, wwt.getDec()]
  const listeners: Array<(position: { ra: number; dec: number }) => void> = []

  // Poll while the user drags, and until the view stops coasting.
  let frame = 0
  let down = false
  let last: [number, number] = centre()
  let still = 0
  const tick = () => {
    const [nra, ndec] = centre()
    if (nra !== last[0] || ndec !== last[1]) {
      last = [nra, ndec]
      still = 0
      for (const listener of listeners) listener({ ra: nra, dec: ndec })
    } else {
      still++
    }
    frame = down || still < SETTLE_FRAMES ? requestAnimationFrame(tick) : 0
  }
  const startPolling = () => {
    still = 0
    if (!frame) frame = requestAnimationFrame(tick)
  }
  el.addEventListener('pointerdown', () => {
    down = true
    startPolling()
  })
  const release = () => {
    down = false
    startPolling()
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)

  return {
    setFov(degrees) {
      fov = degrees
      const [cra, cdec] = centre()
      wwt.gotoRaDecZoom(cra, cdec, fov, true, 0)
    },
    gotoRaDec(nra, ndec) {
      wwt.gotoRaDecZoom(nra, ndec, fov, true, 0)
    },
    getRaDec: () => centre(),
    on(_event, callback) {
      listeners.push(callback)
    },
  }
}
