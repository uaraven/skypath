/**
 * The panel's own job: assembling the two charts for one object on one night,
 * and the time slider that scrubs both of them together. The charts' own
 * rendering is covered next to each of them.
 */

import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ResultsPanel from './ResultsPanel.svelte'
import type { GeoLocation } from '../lib/astro/types'
import { MOON, objectById, objectByDesignation } from '../lib/catalog'
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

/**
 * The two night sliders (altitude + all-sky), which scrub the shared time
 * marker in step. The yearly chart below them has its own, independent
 * slider over dates rather than times of night — excluded here by taking
 * just the first two, DOM order matching source order.
 */
const sliders = () =>
  (screen.getAllByRole('slider') as HTMLInputElement[]).slice(0, 2)

/** The two night-slider readouts, distinct from the chart's own axis date labels. */
const readouts = () =>
  (Array.from(document.querySelectorAll('.readout')) as HTMLElement[]).slice(
    0,
    2,
  )

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

  it('shows the same altitude reading beside both sliders', () => {
    setup()

    const [altitudeReadout, allSkyReadout] = readouts()
    expect(altitudeReadout.textContent).toMatch(/—\s*Alt:\s*-?\d+°/)
    expect(allSkyReadout.textContent).toBe(altitudeReadout.textContent)
  })

  it('shows the Moon separation beside both sliders for an ordinary target', () => {
    setup()

    for (const readout of readouts()) {
      expect(readout.textContent).toMatch(
        /—\s*Alt:\s*-?\d+°\s*·\s*To Moon:\s*\d+°$/,
      )
    }
  })

  it('omits the Moon separation when the Moon itself is the target', () => {
    setup({ object: MOON })

    for (const readout of readouts()) {
      expect(readout.textContent).toMatch(/—\s*Alt:\s*-?\d+°$/)
      expect(readout.textContent).not.toMatch(/Moon/)
    }
  })

  it('keeps the Moon separation in step between both sliders after a scrub', async () => {
    setup()

    await fireEvent.input(sliders()[0], { target: { value: '300' } })

    const [altitudeReadout, allSkyReadout] = readouts()
    expect(altitudeReadout.textContent).toBe(allSkyReadout.textContent)
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

  it('shows a sky view of the object', () => {
    const { container } = setup()

    // Scoped to the sky-view block: the charts also carry `role="img"`.
    expect(
      container.querySelector('.object-sky-view [role="img"]'),
    ).toHaveAttribute('aria-label', `Sky view of ${M13.name}`)
    // RA-to-degrees conversion and field-of-view sizing are pinned in
    // `lib/images/aladin.test.ts`; this just checks the panel wires them in.
    expect(screen.getByText(/field$/)).toBeInTheDocument()
  })

  // A survey cutout is of fixed sky, so it says nothing useful about a body
  // that moves across it.
  it('offers no sky view for the planets or the Moon', () => {
    const { container: planet } = setup({ object: objectById('jupiter')! })
    expect(planet.querySelector('.object-sky-view')).toBeNull()

    const { container: moon } = setup({ object: MOON })
    expect(moon.querySelector('.object-sky-view')).toBeNull()
  })

  const yearlyPanel = (container: HTMLElement) =>
    [...container.querySelectorAll('.panel')].find(
      (panel) =>
        panel.querySelector('h3')?.textContent ===
        'Yearly altitude at midnight',
    )!

  it('shows the yearly altitude panel below the all-sky view, with a trajectory', () => {
    const { container } = setup()

    const headings = [...container.querySelectorAll('h3')].map(
      (h) => h.textContent,
    )
    expect(headings.indexOf('Yearly altitude at midnight')).toBeGreaterThan(
      headings.indexOf('All-sky view'),
    )
    expect(yearlyPanel(container).querySelector('.trajectory')).not.toBeNull()
  })

  it('gives the yearly chart its own slider, defaulted to the chosen date', () => {
    const { container } = setup()

    const yearlySlider = yearlyPanel(container).querySelector(
      'input[type="range"]',
    ) as HTMLInputElement
    expect(yearlySlider).not.toBeNull()
    // Oct 15 2026 is day 288 (index 287) of the year.
    expect(yearlySlider.value).toBe('287')
    expect(
      yearlyPanel(container).querySelector('.readout')!.textContent,
    ).toMatch(/Oct 15/)
  })

  it('plots a different year once the date crosses New Year', async () => {
    const { container, rerender } = setup({ date: new Date(2026, 11, 28) })
    const pathBefore = yearlyPanel(container)
      .querySelector('.trajectory')!
      .getAttribute('d')

    await rerender({ date: new Date(2027, 0, 4) })
    const pathAfter = yearlyPanel(container)
      .querySelector('.trajectory')!
      .getAttribute('d')

    // 2026 and 2027 plot different altitudes at the same calendar dates, so
    // crossing the boundary redraws the curve even though the month axis
    // (Jan..Dec either way) looks unchanged.
    expect(pathAfter).not.toBe(pathBefore)
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
