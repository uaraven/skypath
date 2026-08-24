/**
 * jsdom never fetches a real `<script>`, so `load`/`error` are dispatched by
 * hand, and jsdom's real `getContext('webgl2')` returns `null`, so leaving it
 * unstubbed doubles as the "WebGL2 unavailable" test. Nothing here ever
 * touches aladin.cds.unistra.fr.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AladinLoader } from './aladinLoader'

const SCRIPT_SELECTOR =
  'script[src="https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js"]'

function scripts() {
  return document.querySelectorAll(SCRIPT_SELECTOR)
}

function stubWebgl2() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as unknown as WebGL2RenderingContext,
  )
}

async function importLoader(): Promise<{ loadAladinView: AladinLoader }> {
  return import('./aladinLoader')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  scripts().forEach((script) => script.remove())
  delete (window as { A?: unknown }).A
})

describe('WebGL2 unavailable', () => {
  it('rejects without touching the network', async () => {
    const { loadAladinView } = await importLoader()

    await expect(
      loadAladinView(document.createElement('div'), {
        target: '10 20',
        fov: 1,
        survey: 'P/DSS2/color',
      }),
    ).rejects.toThrow(/webgl2/i)

    expect(scripts()).toHaveLength(0)
  })
})

describe('loading', () => {
  it('injects the script once and mounts Aladin with the minimal viewer options', async () => {
    stubWebgl2()
    const { loadAladinView } = await importLoader()
    const el = document.createElement('div')

    const promise = loadAladinView(el, {
      target: '10.68 41.27',
      fov: 2,
      survey: 'P/DSS2/color',
    })

    const script = document.querySelector(SCRIPT_SELECTOR)!
    const aladin = vi.fn()
    window.A = { init: Promise.resolve(), aladin }
    script.dispatchEvent(new Event('load'))

    await promise

    expect(aladin).toHaveBeenCalledTimes(1)
    const [calledEl, options] = aladin.mock.calls[0]
    expect(calledEl).toBe(el)
    expect(options).toMatchObject({
      target: '10.68 41.27',
      fov: 2,
      survey: 'P/DSS2/color',
      cooFrame: 'ICRSd',
      showReticle: false,
      showZoomControl: false,
      showFullscreenControl: false,
      showLayersControl: false,
      showShareControl: false,
      showProjectionControl: false,
      showFrame: false,
      // The coordinate-readout overlay and FOV indicator — the two visible
      // "ugly corner text" bits Aladin shows by default.
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
    })
  })

  it('reuses the cached script across mounts', async () => {
    stubWebgl2()
    const { loadAladinView } = await importLoader()

    const first = loadAladinView(document.createElement('div'), {
      target: '0 0',
      fov: 1,
      survey: 'P/DSS2/color',
    })
    window.A = { init: Promise.resolve(), aladin: vi.fn() }
    document.querySelector(SCRIPT_SELECTOR)!.dispatchEvent(new Event('load'))
    await first

    await loadAladinView(document.createElement('div'), {
      target: '0 0',
      fov: 1,
      survey: 'P/DSS2/color',
    })

    expect(scripts()).toHaveLength(1)
  })
})

describe('failure', () => {
  it('rejects when the script fails to load, and clears the cache so a retry re-injects it', async () => {
    stubWebgl2()
    const { loadAladinView } = await importLoader()

    const first = loadAladinView(document.createElement('div'), {
      target: '0 0',
      fov: 1,
      survey: 'P/DSS2/color',
    })
    document.querySelector(SCRIPT_SELECTOR)!.dispatchEvent(new Event('error'))
    await expect(first).rejects.toThrow()

    const second = loadAladinView(document.createElement('div'), {
      target: '0 0',
      fov: 1,
      survey: 'P/DSS2/color',
    })
    expect(scripts()).toHaveLength(2)

    window.A = { init: Promise.resolve(), aladin: vi.fn() }
    scripts()[1].dispatchEvent(new Event('load'))
    await expect(second).resolves.toBeUndefined()
  })

  it('rejects if Aladin never finishes initializing', async () => {
    vi.useFakeTimers()
    stubWebgl2()
    const { loadAladinView } = await importLoader()

    const promise = loadAladinView(document.createElement('div'), {
      target: '0 0',
      fov: 1,
      survey: 'P/DSS2/color',
    })
    // `A.init` never settles — simulates a hung or blocked initialization.
    window.A = { init: new Promise(() => {}), aladin: vi.fn() }
    document.querySelector(SCRIPT_SELECTOR)!.dispatchEvent(new Event('load'))

    const assertion = expect(promise).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(15000)
    await assertion
  })
})
