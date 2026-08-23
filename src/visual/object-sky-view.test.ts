/**
 * The sky-view block, measured in a real browser: whether the box is really
 * reserved before Aladin mounts, and whether collapsing really reclaims the
 * space it was added for.
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
import type { AladinLoader } from '../components/aladinLoader'
import ObjectSkyView from '../components/ObjectSkyView.svelte'
import { screenshot } from './screenshot'

const fakeLoadAladin: AladinLoader = (el) =>
  new Promise((resolve) => {
    setTimeout(() => {
      el.style.background = 'linear-gradient(135deg, #1a2540, #0d1220)'
      resolve()
    }, 50)
  })

function renderBlock() {
  // `target` collides with testing-library's own render option of the same
  // name, so every prop has to go under `props` here.
  const { container } = render(ObjectSkyView, {
    props: {
      target: '10.68 41.27',
      fov: 1.5,
      survey: 'P/DSS2/color',
      alt: 'Sky view of M13',
      caption: '45′ field · DSS2 color',
      loadAladin: fakeLoadAladin,
    },
  })
  return { container, frame: () => container.querySelector('.frame') }
}

const toggle = () => screen.getByRole('button', { name: /sky view/i })

describe('sky view block', () => {
  it('reserves a square box at the standard preview size', () => {
    const { frame } = renderBlock()

    const box = frame()!.getBoundingClientRect()

    // Square, so the layout below does not shift when Aladin mounts; and
    // capped at 300px, matching the old static-image size.
    expect(box.height).toBeCloseTo(box.width, 0)
    expect(box.width).toBeCloseTo(300, 0)
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
    const { container } = renderBlock()

    const expanded = container
      .querySelector('.object-sky-view')!
      .getBoundingClientRect().height
    await userEvent.click(toggle())
    const collapsed = container
      .querySelector('.object-sky-view')!
      .getBoundingClientRect().height

    expect(expanded).toBeGreaterThan(300)
    expect(collapsed).toBeLessThan(expanded - 250)
    // The heading stays reachable, or the block could not be reopened.
    expect(toggle()).toBeVisible()
  })

  it('paints the view once it is ready', async () => {
    const { container } = renderBlock()

    const view = container.querySelector('[role="img"]')!
    await expect
      .poll(() => view.getBoundingClientRect().height)
      .toBeGreaterThan(0)
    await expect.poll(() => screen.queryByRole('status')).toBeNull()
    expect(view).toBeVisible()

    await document.fonts.ready
    await screenshot(
      'object-sky-view',
      container.querySelector('.object-sky-view')!,
    )
  })
})
