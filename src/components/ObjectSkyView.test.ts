/**
 * Every case here injects a fake `loadAladin` prop instead of the real CDN
 * loader — this component never touches the network or WebGL in tests; that
 * belongs to `aladinLoader.test.ts`. Everything here is about what the
 * component does around the load, which is the part that is ours.
 */

import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { AladinLoader } from './aladinLoader'
import ObjectSkyView from './ObjectSkyView.svelte'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(overrides = {}) {
  return render(ObjectSkyView, {
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

describe('ObjectSkyView', () => {
  it('starts expanded and invokes the loader', () => {
    const loadAladin = vi.fn<AladinLoader>(() => deferred<void>().promise)
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
    const loadAladin = vi.fn(() => deferred<void>().promise)
    setup({ open: false, loadAladin })

    expect(loadAladin).not.toHaveBeenCalled()
    expect(view()).toBeNull()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('collapses on click and re-invokes the loader on reopen', async () => {
    const loadAladin = vi.fn(() => Promise.resolve())
    setup({ loadAladin })
    expect(loadAladin).toHaveBeenCalledTimes(1)

    await fireEvent.click(toggle())
    expect(view()).toBeNull()

    await fireEvent.click(toggle())
    expect(loadAladin).toHaveBeenCalledTimes(2)
  })

  it('spins until the loader resolves', async () => {
    const { promise, resolve } = deferred<void>()
    setup({ loadAladin: () => promise })

    expect(spinner()).toBeInTheDocument()
    expect(view()).toHaveClass('hidden')

    resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(spinner()).not.toBeInTheDocument()
    expect(view()).not.toHaveClass('hidden')
  })

  it('spins again against a fresh container when the object changes', async () => {
    const loadAladin = vi.fn<AladinLoader>(() => Promise.resolve())
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
    const { promise: firstAttempt, reject } = deferred<void>()
    const loadAladin = vi.fn().mockReturnValueOnce(firstAttempt)
    setup({ loadAladin })
    const firstContainer = view()

    reject(new Error('nope'))
    await firstAttempt.catch(() => {})
    await Promise.resolve()

    loadAladin.mockReturnValueOnce(deferred<void>().promise)
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(loadAladin).toHaveBeenCalledTimes(2)
    // A fresh container, not the one the failed attempt was mounted into —
    // Aladin has no API to re-target or destroy an existing instance.
    expect(view()).not.toBe(firstContainer)
    expect(spinner()).toBeInTheDocument()
  })

  it('describes the view and the field it covers', () => {
    setup({ loadAladin: () => deferred<void>().promise })

    expect(view()).toHaveAttribute('aria-label', 'Sky view of M13')
    expect(screen.getByText('45′ field · DSS2 color')).toBeInTheDocument()
  })
})
