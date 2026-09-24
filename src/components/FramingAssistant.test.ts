/**
 * Every case here injects a fake `loadAladin` prop instead of the real CDN
 * loader — this component never touches the network or WebGL in tests; that
 * belongs to `aladinLoader.test.ts`. Everything here is about what the
 * component does around the load, plus the frame rectangle and rotation
 * slider that came with the framing assistant (this file replaces
 * `ObjectSkyView.test.ts`).
 */

import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { AladinHandle, AladinLoader } from './aladinLoader'
import FramingAssistant from './FramingAssistant.svelte'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function fakeHandle(overrides: Partial<AladinHandle> = {}): AladinHandle {
  return {
    setFov: vi.fn(),
    gotoRaDec: vi.fn(),
    getRaDec: vi.fn(() => [10.68, 41.27]),
    on: vi.fn(),
    ...overrides,
  }
}

function setup(overrides = {}) {
  return render(FramingAssistant, {
    // `target` collides with testing-library's own render option of the same
    // name, so every prop has to go under `props` here.
    props: {
      target: '10.68 41.27',
      fov: 1.5,
      survey: 'P/DSS2/color',
      alt: 'Sky view of M13',
      caption: '45′ field · DSS2 color',
      ...overrides,
    },
  })
}

const view = () => document.querySelector('[role="img"]')
const spinner = () => screen.queryByRole('status')
const toggle = () => screen.getByRole('button', { name: /sky view/i })
const frameRect = () => document.querySelector('.frame-rect')
const rotationSlider = () =>
  screen.queryByRole('slider', { name: /camera rotation/i })
const recenterButton = () =>
  screen.queryByRole('button', { name: /recenter/i })
const centerCoords = () => document.querySelector('.center-coords')

describe('loading', () => {
  it('starts expanded and invokes the loader', () => {
    const loadAladin = vi.fn<AladinLoader>(
      () => deferred<AladinHandle>().promise,
    )
    setup({ loadAladin })

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(loadAladin).toHaveBeenCalledTimes(1)
    const [el, options] = loadAladin.mock.calls[0]
    expect(el).toBeInstanceOf(HTMLElement)
    expect(options).toEqual({
      target: '10.68 41.27',
      fov: 1.5,
      survey: 'P/DSS2/color',
    })
  })

  // The whole reason the container is bound to `open`: a collapsed block
  // must not spend a load on a view nobody asked to see.
  it('requests nothing while collapsed', () => {
    const loadAladin = vi.fn(() => deferred<AladinHandle>().promise)
    setup({ open: false, loadAladin })

    expect(loadAladin).not.toHaveBeenCalled()
    expect(view()).toBeNull()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('collapses on click and re-invokes the loader on reopen', async () => {
    const loadAladin = vi.fn(() => Promise.resolve(fakeHandle()))
    setup({ loadAladin })
    expect(loadAladin).toHaveBeenCalledTimes(1)

    await fireEvent.click(toggle())
    expect(view()).toBeNull()

    await fireEvent.click(toggle())
    expect(loadAladin).toHaveBeenCalledTimes(2)
  })

  it('spins until the loader resolves', async () => {
    const { promise, resolve } = deferred<AladinHandle>()
    setup({ loadAladin: () => promise })

    expect(spinner()).toBeInTheDocument()
    expect(view()).toHaveClass('hidden')

    resolve(fakeHandle())
    await Promise.resolve()
    await Promise.resolve()

    expect(spinner()).not.toBeInTheDocument()
    expect(view()).not.toHaveClass('hidden')
  })

  it('spins again against a fresh container when the object changes', async () => {
    const loadAladin = vi.fn<AladinLoader>(() => Promise.resolve(fakeHandle()))
    const { rerender } = setup({ loadAladin })
    await Promise.resolve()
    await Promise.resolve()
    const firstView = view()

    await rerender({ target: '5.5 -5.5', fov: 1.5, survey: 'P/DSS2/color' })

    expect(loadAladin).toHaveBeenCalledTimes(2)
    expect(loadAladin.mock.calls[1][1]).toEqual({
      target: '5.5 -5.5',
      fov: 1.5,
      survey: 'P/DSS2/color',
    })
    // A stale mount under the new title would be a view of the wrong
    // object, so a change of target remounts a fresh container.
    expect(view()).not.toBe(firstView)
  })

  it('offers a retry when the loader fails', async () => {
    setup({ loadAladin: () => Promise.reject(new Error('nope')) })

    await Promise.resolve()
    await Promise.resolve()

    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument()
    expect(spinner()).not.toBeInTheDocument()
  })

  it('retries against a fresh container', async () => {
    const { promise: firstAttempt, reject } = deferred<AladinHandle>()
    const loadAladin = vi.fn().mockReturnValueOnce(firstAttempt)
    setup({ loadAladin })
    const firstContainer = view()

    reject(new Error('nope'))
    await firstAttempt.catch(() => {})
    await Promise.resolve()

    loadAladin.mockReturnValueOnce(deferred<AladinHandle>().promise)
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(loadAladin).toHaveBeenCalledTimes(2)
    // A fresh container, not the one the failed attempt was mounted into —
    // Aladin has no API to re-target or destroy an existing instance.
    expect(view()).not.toBe(firstContainer)
    expect(spinner()).toBeInTheDocument()
  })

  it('describes the view and the field it covers', () => {
    setup({ loadAladin: () => deferred<AladinHandle>().promise })

    expect(view()).toHaveAttribute('aria-label', 'Sky view of M13')
    expect(screen.getByText('45′ field · DSS2 color')).toBeInTheDocument()
  })
})

describe('the frame rectangle', () => {
  it('is absent with no rig (frame: null)', async () => {
    setup({ loadAladin: () => Promise.resolve(fakeHandle()), frame: null })
    await Promise.resolve()
    await Promise.resolve()

    expect(frameRect()).toBeNull()
    expect(rotationSlider()).toBeNull()
  })

  it('is drawn once a rig gives a frame, only after the view is ready', async () => {
    const { promise, resolve } = deferred<AladinHandle>()
    setup({ loadAladin: () => promise, frame: { width: 0.8, height: 0.4 } })

    // Not drawn while still loading — nothing to anchor it to yet.
    expect(frameRect()).toBeNull()

    resolve(fakeHandle())
    await Promise.resolve()
    await Promise.resolve()

    const rect = frameRect()!
    expect(rect).not.toBeNull()
    expect(rect.getAttribute('width')).toBe('80')
    expect(rect.getAttribute('height')).toBe('40')
  })

  it('shows the rotation slider whenever a frame is present', async () => {
    setup({
      loadAladin: () => Promise.resolve(fakeHandle()),
      frame: { width: 0.8, height: 0.4 },
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(rotationSlider()).toBeInTheDocument()
  })
})

describe('rotation', () => {
  it('rotates the rectangle to match the position angle, sign included', async () => {
    setup({
      loadAladin: () => Promise.resolve(fakeHandle()),
      frame: { width: 0.8, height: 0.4 },
      rotation: 90,
    })
    await Promise.resolve()
    await Promise.resolve()

    // North-through-east PA 90° is -90° on screen (Aladin renders east to
    // the left) — see the file doc and lib/images/framing.test.ts.
    expect(frameRect()!.getAttribute('transform')).toBe('rotate(-90 50 50)')
  })

  it('updates the transform as the slider moves', async () => {
    setup({
      loadAladin: () => Promise.resolve(fakeHandle()),
      frame: { width: 0.8, height: 0.4 },
      rotation: 0,
    })
    await Promise.resolve()
    await Promise.resolve()

    await fireEvent.input(rotationSlider()!, { target: { value: '45' } })

    expect(frameRect()!.getAttribute('transform')).toBe('rotate(-45 50 50)')
  })
})

describe('changing fov without remounting', () => {
  it('pushes a fov change through the handle instead of reloading', async () => {
    const handle = fakeHandle()
    const loadAladin = vi.fn<AladinLoader>(() => Promise.resolve(handle))
    const { rerender } = setup({ loadAladin, fov: 1.5 })
    await Promise.resolve()
    await Promise.resolve()
    expect(loadAladin).toHaveBeenCalledTimes(1)

    await rerender({
      target: '10.68 41.27',
      survey: 'P/DSS2/color',
      fov: 3,
      alt: 'Sky view of M13',
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(handle.setFov).toHaveBeenCalledWith(3)
    // Same target/survey — a rig switch must not re-invoke the loader.
    expect(loadAladin).toHaveBeenCalledTimes(1)
  })
})

describe('recenter', () => {
  it('is absent until the view is ready', () => {
    setup({ loadAladin: () => deferred<AladinHandle>().promise })

    expect(recenterButton()).toBeNull()
  })

  it('sends the view back to the original target and fov', async () => {
    const handle = fakeHandle()
    setup({
      loadAladin: () => Promise.resolve(handle),
      target: '10.68 41.27',
      fov: 1.5,
    })
    await Promise.resolve()
    await Promise.resolve()

    await fireEvent.click(recenterButton()!)

    expect(handle.gotoRaDec).toHaveBeenCalledWith(10.68, 41.27)
    expect(handle.setFov).toHaveBeenCalledWith(1.5)
  })

  it('is offered with or without a rig frame', async () => {
    setup({
      loadAladin: () => Promise.resolve(fakeHandle()),
      frame: { width: 0.8, height: 0.4 },
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(recenterButton()).toBeInTheDocument()
  })
})

describe('coordinate readout', () => {
  it('is absent until the view is ready', () => {
    setup({ loadAladin: () => deferred<AladinHandle>().promise })

    expect(centerCoords()).toBeNull()
  })

  it('seeds from getRaDec once the view loads', async () => {
    setup({
      loadAladin: () =>
        Promise.resolve(fakeHandle({ getRaDec: () => [10.68, 41.27] })),
    })
    await Promise.resolve()
    await Promise.resolve()

    // formatRa takes hours, getRaDec reports degrees — 10.68° / 15 = 0.712h.
    expect(centerCoords()!.textContent).toContain('RA: 00h 42m 43s')
    expect(centerCoords()!.textContent).toContain('Dec: +41° 16′ 12″')
  })

  it('tracks positionChanged as the user pans', async () => {
    let onPositionChanged: ((p: { ra: number; dec: number }) => void) | null =
      null
    const handle = fakeHandle({
      getRaDec: () => [10.68, 41.27],
      on: (_event, callback) => {
        onPositionChanged = callback
      },
    })
    setup({ loadAladin: () => Promise.resolve(handle) })
    await Promise.resolve()
    await Promise.resolve()
    expect(centerCoords()!.textContent).toContain('Dec: +41° 16′ 12″')

    onPositionChanged!({ ra: 20, dec: -10 })
    await Promise.resolve()

    expect(centerCoords()!.textContent).toContain('RA: 01h 20m 00s')
    expect(centerCoords()!.textContent).toContain('Dec: -10° 00′ 00″')
  })
})

describe('zoom is disabled, panning is not', () => {
  async function readyView(overrides: Record<string, unknown> = {}) {
    setup({ loadAladin: () => Promise.resolve(fakeHandle()), ...overrides })
    await Promise.resolve()
    await Promise.resolve()
    return view()!
  }

  it('stops a wheel event before it reaches a descendant (Aladin\'s canvas)', async () => {
    const el = await readyView()
    const canvas = document.createElement('canvas')
    el.appendChild(canvas)
    const spy = vi.fn()
    canvas.addEventListener('wheel', spy)

    canvas.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true }),
    )

    expect(spy).not.toHaveBeenCalled()
  })

  it('stops a two-finger touch (pinch) before it reaches a descendant', async () => {
    const el = await readyView()
    const canvas = document.createElement('canvas')
    el.appendChild(canvas)
    const spy = vi.fn()
    canvas.addEventListener('touchstart', spy)

    canvas.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [{} as Touch, {} as Touch],
      }),
    )

    expect(spy).not.toHaveBeenCalled()
  })

  it('lets a single-finger touch through, so drag-to-pan still works', async () => {
    const el = await readyView()
    const canvas = document.createElement('canvas')
    el.appendChild(canvas)
    const spy = vi.fn()
    canvas.addEventListener('touchstart', spy)

    canvas.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [{} as Touch],
      }),
    )

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
