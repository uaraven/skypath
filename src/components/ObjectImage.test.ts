/**
 * jsdom never loads an image, so `load` and `error` are dispatched by hand.
 * That is the point: everything here is about what the component does around
 * the image, which is the part that is ours.
 */

import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ObjectImage from './ObjectImage.svelte'

const URL_A = 'https://example.test/sky.gif?a=1'
const URL_B = 'https://example.test/sky.gif?b=2'

function setup(overrides = {}) {
  return render(ObjectImage, {
    url: URL_A,
    alt: 'Digitized Sky Survey image of M13',
    caption: '45′ field · DSS2 red',
    ...overrides,
  })
}

const image = () => document.querySelector('img')
const spinner = () => screen.queryByRole('status')
const toggle = () => screen.getByRole('button', { name: /sky image/i })

describe('ObjectImage', () => {
  it('starts expanded and requests the image', () => {
    setup()

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(image()).toHaveAttribute('src', URL_A)
  })

  // The whole reason `src` is bound to `open`: a collapsed block must not
  // spend a download on an image nobody asked to see.
  it('requests nothing while collapsed', () => {
    setup({ open: false })

    expect(image()).toBeNull()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('collapses and expands on click', async () => {
    setup()

    await fireEvent.click(toggle())
    expect(image()).toBeNull()

    await fireEvent.click(toggle())
    expect(image()).toHaveAttribute('src', URL_A)
  })

  it('spins until the image arrives', async () => {
    setup()

    expect(spinner()).toBeInTheDocument()

    await fireEvent.load(image()!)

    expect(spinner()).not.toBeInTheDocument()
    expect(image()).toBeVisible()
  })

  it('spins again when the object changes', async () => {
    const { rerender } = setup()
    await fireEvent.load(image()!)

    await rerender({ url: URL_B, alt: 'Digitized Sky Survey image of M31' })

    // A stale decoded frame under the new title would be a picture of the
    // wrong object, so the previous load does not count for the new url.
    expect(spinner()).toBeInTheDocument()
    expect(image()).toHaveAttribute('src', URL_B)
  })

  it('offers a retry when the load fails', async () => {
    setup()

    await fireEvent.error(image()!)

    // Only a network failure can get here — SkyView reports its own errors
    // inside a 200 GIF — so the copy must not claim there is no imagery.
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument()
    expect(spinner()).not.toBeInTheDocument()
  })

  it('retries with a fresh url so the browser does not serve the failure', async () => {
    setup()
    await fireEvent.error(image()!)

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(spinner()).toBeInTheDocument()
    const src = image()!.getAttribute('src')!
    expect(src).toContain(URL_A)
    expect(src).not.toBe(URL_A)
  })

  it('describes the image and the field it covers', () => {
    setup()

    expect(screen.getByAltText(/image of M13/)).toBeInTheDocument()
    expect(screen.getByText('45′ field · DSS2 red')).toBeInTheDocument()
  })
})
