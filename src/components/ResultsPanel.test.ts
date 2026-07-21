/**
 * The panel's own job: assembling the two charts for one object on one night,
 * and the time slider that scrubs both of them together. The charts' own
 * rendering is covered next to each of them.
 */

import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ResultsPanel from './ResultsPanel.svelte'
import type { GeoLocation } from '../lib/astro/types'
import { MOON, objectByDesignation } from '../lib/catalog'
import { FLAT_HORIZON } from '../lib/horizon'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const M13 = objectByDesignation('M13')!

function setup(overrides = {}) {
  return render(ResultsPanel, {
    object: M13,
    location: KYIV,
    horizon: FLAT_HORIZON,
    date: new Date(2026, 9, 15),
    observatoryName: 'Backyard',
    ...overrides,
  })
}

const sliders = () => screen.getAllByRole('slider') as HTMLInputElement[]

/** The two slider readouts, distinct from the chart's own axis date labels. */
const readouts = () =>
  Array.from(document.querySelectorAll('.readout')) as HTMLElement[]

/** Marker apex x on the altitude chart, which is the one that always has one. */
function markerX(container: HTMLElement): number {
  const d = container.querySelector('.chart .marker')!.getAttribute('d')!
  return Number(d.match(/[\d.]+/)![0])
}

describe('ResultsPanel', () => {
  it('starts both sliders at local midnight', () => {
    setup()

    const [altitude, allSky] = sliders()
    // The window runs local noon → noon, so midnight is 720 minutes in.
    expect(altitude.value).toBe('720')
    expect(allSky.value).toBe('720')
    const readoutTexts = readouts()
    expect(readoutTexts).toHaveLength(2)
    for (const readout of readoutTexts) {
      expect(readout.textContent).toMatch(/Oct 16/)
    }
  })

  it('spans the whole night window', () => {
    setup()

    for (const slider of sliders()) {
      expect(slider.min).toBe('0')
      expect(slider.max).toBe('1440')
    }
  })

  // The two charts show the same instant from different angles; letting them
  // drift apart would make the pair of indicators mean nothing.
  it('keeps the sliders and both readouts in step', async () => {
    setup()

    await fireEvent.input(sliders()[1], { target: { value: '1230' } })

    expect(sliders()[0].value).toBe('1230')
    for (const readout of readouts()) {
      expect(readout.textContent).toMatch(/Oct 16.*08:30|Oct 16.*8:30/)
    }
  })

  it('moves the chart indicator when the slider moves', async () => {
    const { container } = setup()

    const before = markerX(container)
    await fireEvent.input(sliders()[0], { target: { value: '1080' } })

    expect(markerX(container)).toBeGreaterThan(before)
  })

  it('offers the Moon overlay for an ordinary target', () => {
    setup()

    expect(screen.getAllByText('Show the Moon')).toHaveLength(2)
  })

  it('hides the Moon overlay toggle when the Moon itself is the target', () => {
    const { container } = setup({ object: MOON })

    // No overlay to toggle — the Moon's own track already shows it.
    expect(screen.queryByText('Show the Moon')).not.toBeInTheDocument()
    // And no dimmed companion track is drawn on top of the primary trajectory.
    expect(container.querySelector('.moon-track')).toBeNull()
  })

  it('keeps the chosen time of night when the date changes', async () => {
    const { rerender } = setup()

    await fireEvent.input(sliders()[0], { target: { value: '900' } })
    await rerender({ date: new Date(2026, 9, 20) })

    expect(sliders()[0].value).toBe('900')
    const readoutTexts = readouts()
    expect(readoutTexts).toHaveLength(2)
    for (const readout of readoutTexts) {
      expect(readout.textContent).toMatch(/Oct 21/)
    }
  })
})
