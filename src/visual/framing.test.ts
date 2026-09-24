/**
 * The framing assistant block, measured in a real browser: whether the box
 * is really reserved before Aladin mounts, whether collapsing really
 * reclaims the space it was added for, and — new for the framing assistant —
 * whether the camera-frame rectangle is really the size and orientation the
 * geometry in `lib/images/framing.ts` says it should be. Replaces
 * `object-sky-view.test.ts`.
 *
 * The loader is a fake that paints a plain block into the container after a
 * short delay — enough to exercise the real layout and the loading state.
 * **Nothing here may touch aladin.cds.unistra.fr**: a real Aladin Lite fetch
 * (CDN script + WASM + live HiPS tiles) in the suite would be exactly the
 * kind of third-party round trip this project's visual tests are built to
 * avoid, and the view-parameter building it would exercise is already pinned
 * by unit tests.
 */

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AladinHandle, AladinLoader } from '../components/aladinLoader'
import FramingAssistant from '../components/FramingAssistant.svelte'
import type { DeepSkyObject } from '../lib/astro/types'
import { framingViewParams } from '../lib/images'
import type { Rig } from '../lib/rig'
import { screenshot } from './screenshot'

const fakeLoadAladin: AladinLoader = (el) =>
  new Promise<AladinHandle>((resolve) => {
    setTimeout(() => {
      el.style.background = 'linear-gradient(135deg, #1a2540, #0d1220)'
      resolve({
        setFov: () => {},
        gotoRaDec: () => {},
        getRaDec: () => [10.68, 41.27],
        on: () => {},
      })
    }, 50)
  })

function renderBlock(overrides: Record<string, unknown> = {}) {
  // `target` collides with testing-library's own render option of the same
  // name, so every prop has to go under `props` here.
  const { container } = render(FramingAssistant, {
    props: {
      target: '10.68 41.27',
      fov: 1.5,
      survey: 'P/DSS2/color',
      alt: 'Sky view of M13',
      caption: '45′ field · DSS2 color',
      loadAladin: fakeLoadAladin,
      ...overrides,
    },
  })
  return {
    container,
    frame: () => container.querySelector('.frame'),
    frameRect: () => container.querySelector('.frame-rect'),
    recenterButton: () =>
      screen.queryByRole('button', { name: /recenter/i }),
  }
}

const toggle = () => screen.getByRole('button', { name: /sky view/i })

async function waitUntilReady(view: Element) {
  await expect
    .poll(() => (view as HTMLElement).getBoundingClientRect().height)
    .toBeGreaterThan(0)
  await expect.poll(() => screen.queryByRole('status')).toBeNull()
}

describe('framing assistant block', () => {
  it('reserves a square box sized to half the panel width, floored at 400px', () => {
    const { frame } = renderBlock()

    const box = frame()!.getBoundingClientRect()
    // Whatever the actual containing width resolves to in this harness, the
    // box is square (so mounting Aladin never shifts the layout below it)
    // and never shrinks under the 400px floor (`.plan/framing-assistant-plan.md`
    // decision 10).
    expect(box.height).toBeCloseTo(box.width, 0)
    expect(box.width).toBeGreaterThanOrEqual(400)
  })

  it('spins inside the reserved box while loading', () => {
    const { frame } = renderBlock()

    const spinner = screen.getByRole('status').getBoundingClientRect()
    const box = frame()!.getBoundingClientRect()

    // Painted, and inside the frame rather than pushing the layout around.
    expect(spinner.width).toBeGreaterThan(0)
    expect(spinner.left).toBeGreaterThanOrEqual(box.left)
    expect(spinner.right).toBeLessThanOrEqual(box.right)
  })

  it('collapses to a single line, reclaiming the space', async () => {
    const { container, frame } = renderBlock()
    const boxHeight = frame()!.getBoundingClientRect().height

    const expanded = container
      .querySelector('.framing-assistant')!
      .getBoundingClientRect().height
    await userEvent.click(toggle())
    const collapsed = container
      .querySelector('.framing-assistant')!
      .getBoundingClientRect().height

    expect(expanded).toBeGreaterThan(boxHeight - 1)
    expect(collapsed).toBeLessThan(expanded - boxHeight + 50)
    // The heading stays reachable, or the block could not be reopened.
    expect(toggle()).toBeVisible()
  })

  it('floats the recenter button inside the reserved box, once ready', async () => {
    const { container, frame, recenterButton } = renderBlock()

    const view = container.querySelector('[role="img"]')!
    await waitUntilReady(view)

    const box = frame()!.getBoundingClientRect()
    const button = recenterButton()!.getBoundingClientRect()

    expect(button.width).toBeGreaterThan(0)
    expect(button.left).toBeGreaterThanOrEqual(box.left)
    expect(button.right).toBeLessThanOrEqual(box.right + 1)
    expect(button.top).toBeGreaterThanOrEqual(box.top)
  })

  it('paints the view once it is ready', async () => {
    const { container } = renderBlock()

    const view = container.querySelector('[role="img"]')!
    await waitUntilReady(view)
    expect(view).toBeVisible()

    await document.fonts.ready
    await screenshot(
      'framing-assistant',
      container.querySelector('.framing-assistant')!,
    )
  })
})

describe('the camera-frame rectangle', () => {
  it('fills 1/1.25 of the box on its larger axis, for a rig larger than the target', async () => {
    const { container, frame, frameRect } = renderBlock({
      // The rig's field is the larger axis here — 1/1.25 of the view box.
      frame: { width: 1 / 1.25, height: 0.4 },
    })
    await waitUntilReady(container.querySelector('[role="img"]')!)

    const box = frame()!.getBoundingClientRect()
    const rect = frameRect()!.getBoundingClientRect()

    expect(Math.abs(rect.width - box.width / 1.25)).toBeLessThan(3)
  })

  it('rotates the rectangle so its on-screen bounding box swaps orientation', async () => {
    const { container, frameRect } = renderBlock({
      // Landscape fractions (wider than tall) …
      frame: { width: 0.8, height: 0.4 },
      rotation: 90,
    })
    await waitUntilReady(container.querySelector('[role="img"]')!)

    const rect = frameRect()!.getBoundingClientRect()

    // … rotated 90° measure taller than wide on screen. This is the sign
    // check from `.plan/framing-assistant-plan.md` decision 9, verified as
    // real rendered geometry rather than the raw `transform` attribute
    // string `FramingAssistant.test.ts` already pins.
    expect(rect.height).toBeGreaterThan(rect.width)
  })

  it('is absent with no rig selected', () => {
    const { frameRect } = renderBlock({ frame: null })

    expect(frameRect()).toBeNull()
  })

  // Regression: a near-square sensor's frame used to be sized off its larger
  // axis alone, which fits fine unrotated but reaches past the box once the
  // slider turns it toward 45° — exactly what a screenshot of this bug
  // looked like. `framingViewParams` now sizes off the rig's diagonal, and
  // this proves it holds up as real rendered geometry, not just arithmetic.
  it('never lets the frame rectangle overflow the box, at any rotation', async () => {
    const squarish: Rig = {
      id: 'square',
      name: 'Square-sensor rig',
      telescope: { focalLength: 500 },
      camera: { pixelsX: 3008, pixelsY: 3008, pitchX: 3.76, pitchY: 3.76 },
    }
    const object: DeepSkyObject = {
      id: 'm13',
      name: 'M13',
      kind: 'deep-sky',
      ra: 16.7,
      dec: 36.46,
      size: 20,
    }
    const { fov, frame } = framingViewParams(object, squarish)

    const {
      container,
      frame: frameBox,
      frameRect,
    } = renderBlock({
      fov,
      frame,
      rotation: 45,
    })
    await waitUntilReady(container.querySelector('[role="img"]')!)

    const box = frameBox()!.getBoundingClientRect()
    const rect = frameRect()!.getBoundingClientRect()

    // A couple of pixels' tolerance for the rectangle's own stroke width.
    expect(rect.left).toBeGreaterThanOrEqual(box.left - 2)
    expect(rect.right).toBeLessThanOrEqual(box.right + 2)
    expect(rect.top).toBeGreaterThanOrEqual(box.top - 2)
    expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 2)
  })
})
