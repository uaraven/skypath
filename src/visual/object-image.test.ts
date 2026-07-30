/**
 * The sky-image block, measured in a real browser: whether the box is really
 * reserved before the bytes arrive, and whether collapsing really reclaims the
 * space it was added for.
 *
 * The image is a `data:` URI. **Nothing here may touch skyview.gsfc.nasa.gov**
 * — a ~7 s third-party CGI in the suite is a flake generator, and the URL
 * building it would exercise is already pinned by unit tests.
 */

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ObjectImage from '../components/ObjectImage.svelte'
import { screenshot } from './screenshot'

/** A 1×1 transparent GIF — enough to fire a real `load` event. */
const PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function renderBlock() {
  const { container } = render(ObjectImage, {
    url: PIXEL,
    alt: 'Digitized Sky Survey image of M13',
    caption: '45′ field · DSS2 red',
  })
  return { container, frame: () => container.querySelector('.frame') }
}

const toggle = () => screen.getByRole('button', { name: /sky image/i })

describe('sky image block', () => {
  it('reserves a square box at the image size', () => {
    const { frame } = renderBlock()

    const box = frame()!.getBoundingClientRect()

    // Square, so the layout below does not shift when the image decodes; and
    // capped at the 300px the GIF actually is, so it is never upscaled.
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
      .querySelector('.object-image')!
      .getBoundingClientRect().height
    await userEvent.click(toggle())
    const collapsed = container
      .querySelector('.object-image')!
      .getBoundingClientRect().height

    expect(expanded).toBeGreaterThan(300)
    expect(collapsed).toBeLessThan(expanded - 250)
    // The heading stays reachable, or the block could not be reopened.
    expect(toggle()).toBeVisible()
  })

  it('paints the image once it loads', async () => {
    const { container } = renderBlock()

    const image = container.querySelector('img')!
    await expect
      .poll(() => image.getBoundingClientRect().height)
      .toBeGreaterThan(0)
    await expect.poll(() => screen.queryByRole('status')).toBeNull()
    expect(image).toBeVisible()

    await document.fonts.ready
    await screenshot('object-image', container.querySelector('.object-image')!)
  })
})
