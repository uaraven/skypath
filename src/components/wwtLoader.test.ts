/**
 * jsdom never fetches a real `<script>`, so `load`/`error` are dispatched by
 * hand, and `window.wwtlib` is a hand-written fake of the slice of the engine
 * the loader drives. Nothing here touches web.wwtassets.org.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkyViewLoader } from './skyView'

const SCRIPT_SELECTOR =
  'script[src="https://web.wwtassets.org/engine/7/wwtsdk.js"]'

const scripts = () => document.querySelectorAll(SCRIPT_SELECTOR)

function stubWebgl() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as unknown as WebGL2RenderingContext,
  )
}

async function importLoader(): Promise<{ loadWwtView: SkyViewLoader }> {
  return import('./wwtLoader')
}

function fakeEngine() {
  let ready: () => void = () => {}
  let collectionLoaded: () => void = () => {}
  const setters = { set_showCrosshairs: vi.fn(), set_showGrid: vi.fn() }
  const wwt = {
    add_ready: (cb: () => void) => (ready = cb),
    add_collectionLoaded: (cb: () => void) => (collectionLoaded = cb),
    endInit: vi.fn(),
    loadImageCollection: vi.fn(() => queueMicrotask(() => collectionLoaded())),
    setBackgroundImageByName: vi.fn(),
    gotoRaDecZoom: vi.fn(),
    getRA: vi.fn(() => 0.7),
    getDec: vi.fn(() => 41.27),
    get_fov: vi.fn(() => 2),
    get_roll: vi.fn(() => 0),
    settings: setters,
  }
  const initControl = vi.fn((id: string) => {
    const el = document.getElementById(id)!
    el.appendChild(document.createElement('canvas'))
    queueMicrotask(() => ready())
    return wwt
  })
  return { wwt, setters, initControl }
}

/** Mounts one view, driving the script `load` event the loader waits on. */
async function mount(loadWwtView: SkyViewLoader, el: HTMLElement) {
  document.body.appendChild(el)
  const promise = loadWwtView(el, {
    target: '10.68 41.27',
    fov: 2,
    survey: 'dss-color',
  })
  return promise
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  scripts().forEach((script) => script.remove())
  document.body.innerHTML = ''
  delete (window as { wwtlib?: unknown }).wwtlib
})

describe('WebGL unavailable', () => {
  it('rejects without touching the network', async () => {
    const { loadWwtView } = await importLoader()

    await expect(
      loadWwtView(document.createElement('div'), {
        target: '0 0',
        fov: 1,
        survey: 'dss-color',
      }),
    ).rejects.toThrow('WebGL')
    expect(scripts()).toHaveLength(0)
  })
})

describe('loading', () => {
  it('boots the engine, hides the overlays and aims the view', async () => {
    stubWebgl()
    const { loadWwtView } = await importLoader()
    const { wwt, setters, initControl } = fakeEngine()
    const el = document.createElement('div')

    const promise = mount(loadWwtView, el)
    // The script is injected after the (async) WebGL check, so wait for it.
    await vi.waitFor(() => expect(scripts()).toHaveLength(1))
    window.wwtlib = { WWTControl: { initControl } }
    scripts()[0].dispatchEvent(new Event('load'))

    const handle = await promise

    expect(initControl).toHaveBeenCalledTimes(1)
    expect(initControl.mock.calls[0][0]).toBe(el.id)
    expect(wwt.loadImageCollection).toHaveBeenCalledWith(
      'https://web.wwtassets.org/engine/assets/builtin-image-sets.wtml',
      false,
    )
    expect(setters.set_showCrosshairs).toHaveBeenCalledWith(false)
    expect(setters.set_showGrid).toHaveBeenCalledWith(false)
    expect(wwt.setBackgroundImageByName).toHaveBeenCalledWith(
      'Digitized Sky Survey (Color)',
    )
    // RA stays in degrees, fov is the zoom (viewport height) as-is, instant.
    expect(wwt.gotoRaDecZoom).toHaveBeenCalledWith(10.68, 41.27, 2, true, 0)
    expect(el.querySelector('canvas')).not.toBeNull()
    // getRA answers in hours; the handle reports degrees.
    expect(handle.getRaDec()).toEqual([0.7 * 15, 41.27])
  })

  it('re-aims the same engine for a later mount instead of re-initialising', async () => {
    stubWebgl()
    const { loadWwtView } = await importLoader()
    const { wwt, initControl } = fakeEngine()

    const first = document.createElement('div')
    const promise = mount(loadWwtView, first)
    await vi.waitFor(() => expect(scripts()).toHaveLength(1))
    window.wwtlib = { WWTControl: { initControl } }
    scripts()[0].dispatchEvent(new Event('load'))
    await promise
    const canvas = first.querySelector('canvas')!

    const second = document.createElement('div')
    await mount(loadWwtView, second)

    expect(initControl).toHaveBeenCalledTimes(1)
    expect(scripts()).toHaveLength(1)
    expect(second.contains(canvas)).toBe(true)
    expect(wwt.gotoRaDecZoom).toHaveBeenCalledTimes(2)
  })

  it('setFov and gotoRaDec re-aim in place', async () => {
    stubWebgl()
    const { loadWwtView } = await importLoader()
    const { wwt, initControl } = fakeEngine()

    const promise = mount(loadWwtView, document.createElement('div'))
    await vi.waitFor(() => expect(scripts()).toHaveLength(1))
    window.wwtlib = { WWTControl: { initControl } }
    scripts()[0].dispatchEvent(new Event('load'))
    const handle = await promise

    handle.setFov(5)
    // Keeps the current (possibly panned) centre.
    expect(wwt.gotoRaDecZoom).toHaveBeenLastCalledWith(
      0.7 * 15,
      41.27,
      5,
      true,
      0,
    )

    handle.gotoRaDec(83.8, -5.4)
    // And keeps the most recent fov.
    expect(wwt.gotoRaDecZoom).toHaveBeenLastCalledWith(83.8, -5.4, 5, true, 0)
  })
})

describe('input blocking', () => {
  it('stops right-button and modified drags before the engine sees them', async () => {
    stubWebgl()
    const { loadWwtView } = await importLoader()
    const { initControl } = fakeEngine()
    const el = document.createElement('div')

    const promise = mount(loadWwtView, el)
    await vi.waitFor(() => expect(scripts()).toHaveLength(1))
    window.wwtlib = { WWTControl: { initControl } }
    scripts()[0].dispatchEvent(new Event('load'))
    await promise

    const engineSees = vi.fn()
    el.querySelector('canvas')!.addEventListener('mousedown', engineSees)

    const dispatch = (init: MouseEventInit) =>
      el
        .querySelector('canvas')!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ...init }))

    dispatch({ button: 2 })
    dispatch({ button: 0, ctrlKey: true })
    dispatch({ button: 0, shiftKey: true })
    expect(engineSees).not.toHaveBeenCalled()

    dispatch({ button: 0 })
    expect(engineSees).toHaveBeenCalledTimes(1)
  })
})

describe('scale lock', () => {
  async function mounted() {
    stubWebgl()
    const { loadWwtView } = await importLoader()
    const fake = fakeEngine()
    const el = document.createElement('div')
    const promise = mount(loadWwtView, el)
    await vi.waitFor(() => expect(scripts()).toHaveLength(1))
    window.wwtlib = { WWTControl: { initControl: fake.initControl } }
    scripts()[0].dispatchEvent(new Event('load'))
    await promise
    return { ...fake, el }
  }

  it('stops wheel, gesture, double-click and second-pointer input', async () => {
    const { el } = await mounted()
    const canvas = el.querySelector('canvas')!
    const engineSees = vi.fn()
    for (const type of [
      'wheel',
      'gesturestart',
      'gesturechange',
      'dblclick',
      'pointermove',
    ]) {
      canvas.addEventListener(type, engineSees)
    }

    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    canvas.dispatchEvent(new Event('gesturestart', { bubbles: true }))
    canvas.dispatchEvent(new Event('gesturechange', { bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(engineSees).not.toHaveBeenCalled()

    // First pointer is the pan; a second one would be a pinch.
    const pointer = (type: string, pointerId: number) => {
      const event = new Event(type, { bubbles: true })
      Object.assign(event, { pointerId })
      canvas.dispatchEvent(event)
    }
    pointer('pointerdown', 1)
    pointer('pointermove', 1)
    expect(engineSees).toHaveBeenCalledTimes(1)
    pointer('pointerdown', 2)
    pointer('pointermove', 2)
    expect(engineSees).toHaveBeenCalledTimes(1)
  })

  it('snaps the scale back after a keyboard zoom', async () => {
    let frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    const { wwt } = await mounted()
    wwt.gotoRaDecZoom.mockClear()

    // The engine zoomed in on a keypress: 2° became 1°.
    wwt.get_fov.mockReturnValue(1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }))
    const run = frames
    frames = []
    run.forEach((cb) => cb(0))

    expect(wwt.gotoRaDecZoom).toHaveBeenCalledWith(0.7 * 15, 41.27, 2, true, 0)
  })

  it('leaves a pure pan alone', async () => {
    let frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    const { wwt } = await mounted()
    wwt.gotoRaDecZoom.mockClear()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    const run = frames
    frames = []
    run.forEach((cb) => cb(0))

    expect(wwt.gotoRaDecZoom).not.toHaveBeenCalled()
  })
})

describe('failure', () => {
  it('clears the cache so a Retry injects the script again', async () => {
    stubWebgl()
    const { loadWwtView } = await importLoader()

    const first = mount(loadWwtView, document.createElement('div'))
    await vi.waitFor(() => expect(scripts()).toHaveLength(1))
    scripts()[0].dispatchEvent(new Event('error'))
    await expect(first).rejects.toThrow('Failed to load')

    scripts().forEach((script) => script.remove())
    void mount(loadWwtView, document.createElement('div'))
    await vi.waitFor(() => expect(scripts()).toHaveLength(1))
  })
})
