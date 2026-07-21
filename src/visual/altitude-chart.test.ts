/**
 * Altitude chart geometry, measured in a real browser.
 *
 * The component test asserts the SVG's *structure*; jsdom cannot go further,
 * because it never resolves a viewBox into screen coordinates. These tests
 * measure what the browser actually painted — so they catch a projection that
 * is internally consistent but lands in the wrong place on screen.
 */

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AltitudeChart from '../components/AltitudeChart.svelte'
import type { GeoLocation, SkyObject } from '../lib/astro/types'
import { MOON, objectByDesignation } from '../lib/catalog'
import { altitudeChartModel } from '../lib/charts'
import { horizonFromText } from '../lib/horizon'
import { windowFraction } from '../lib/astro/time'
import carrHorizon from '../lib/horizon/fixtures/e.c.carr-horizon.txt?raw'
import { screenshot } from './screenshot'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const DATE = new Date(2026, 9, 15)
const M13 = objectByDesignation('M13')!

function renderChart() {
  const model = altitudeChartModel({
    object: M13,
    location: KYIV,
    date: DATE,
    horizon: horizonFromText(carrHorizon),
  })
  const { container } = render(AltitudeChart, { model })
  return { container, svg: container.querySelector('svg')!, model }
}

/** Where a y coordinate sits between the plot's 0° and 90° edges. */
function altitudeFraction(svg: SVGSVGElement, y: number): number {
  const frame = svg.querySelector('.frame')!.getBoundingClientRect()
  return (frame.bottom - y) / frame.height
}

/** Where an x coordinate sits between the plot's noon and noon edges. */
function timeFraction(svg: SVGSVGElement, x: number): number {
  const frame = svg.querySelector('.frame')!.getBoundingClientRect()
  return (x - frame.left) / frame.width
}

describe('altitude chart geometry', () => {
  it('paints the peak marker at the height its altitude claims', () => {
    const { svg, model } = renderChart()

    const peak = svg.querySelector('circle.peak')!.getBoundingClientRect()
    const fraction = altitudeFraction(svg, peak.top + peak.height / 2)

    // ~76° of 90 — the whole chain from ephemeris to painted pixel.
    expect(fraction).toBeCloseTo(model.peak!.altitude / 90, 2)
  })

  it('paints the peak marker at the time its trajectory claims', () => {
    const { svg, model } = renderChart()

    const peak = svg.querySelector('circle.peak')!.getBoundingClientRect()

    expect(timeFraction(svg, peak.left + peak.width / 2)).toBeCloseTo(
      windowFraction(model.window, model.peak!.time),
      2,
    )
  })

  it('centres the time axis on local midnight', () => {
    const { svg } = renderChart()

    // The defining property of the noon→noon window: the night sits whole in
    // the middle rather than split across two chart edges.
    const midnight = [...svg.querySelectorAll('.time-label')].find(
      (label) => label.textContent === '00',
    )!
    const box = midnight.getBoundingClientRect()

    expect(timeFraction(svg, box.left + box.width / 2)).toBeCloseTo(0.5, 2)
  })

  it('tiles the twilight bands edge to edge with no visible seams', () => {
    const { svg } = renderChart()

    const frame = svg.querySelector('.frame')!.getBoundingClientRect()
    const bands = [...svg.querySelectorAll('rect.band')].map((rect) =>
      rect.getBoundingClientRect(),
    )

    expect(bands[0].left).toBeCloseTo(frame.left, 0)
    // Bands overlap by a user unit by design; what must not happen is a gap.
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].left).toBeLessThanOrEqual(bands[i - 1].right + 0.5)
    }
    expect(bands[bands.length - 1].right).toBeGreaterThanOrEqual(
      frame.right - 0.5,
    )
  })

  it('keeps every drawn element inside the plot frame', () => {
    const { svg } = renderChart()

    const frame = svg.querySelector('.frame')!.getBoundingClientRect()
    // `getBoundingClientRect` reports the geometry a stroke is centred on and
    // ignores the clip path, so half a stroke width legitimately sticks out.
    // Anything beyond that is the projection escaping the plot.
    const tolerance = 3

    for (const selector of ['.trajectory', '.horizon-fill', 'rect.band']) {
      for (const element of svg.querySelectorAll(selector)) {
        const box = element.getBoundingClientRect()
        expect(box.left).toBeGreaterThanOrEqual(frame.left - tolerance)
        expect(box.right).toBeLessThanOrEqual(frame.right + tolerance)
        expect(box.top).toBeGreaterThanOrEqual(frame.top - tolerance)
        expect(box.bottom).toBeLessThanOrEqual(frame.bottom + tolerance)
      }
    }
  })

  it('shades night darker than day, as the reference rendering does', () => {
    const { svg } = renderChart()

    const fillOf = (phase: string) =>
      getComputedStyle(svg.querySelector(`rect.band[data-phase="${phase}"]`)!)
        .fill

    // If theme.css failed to load these are all the same, and the chart is a
    // flat rectangle no matter what the band structure says.
    const night = luminance(fillOf('night'))
    const astro = luminance(fillOf('astronomical'))
    const day = luminance(fillOf('day'))

    expect(night).toBeLessThan(astro)
    expect(astro).toBeLessThan(day)
  })

  it('renders the axis labels in the mono face, not a fallback', async () => {
    const { svg } = renderChart()

    await document.fonts.ready
    const label = svg.querySelector('.time-label')!
    expect(getComputedStyle(label).fontFamily).toContain('Fira Code')
  })

  it('paints the compass labels in the header band above the plot', () => {
    const { svg } = renderChart()

    const frame = svg.querySelector('.frame')!.getBoundingClientRect()
    const labels = [...svg.querySelectorAll('.cardinal-label')]

    // M13 rises in the east, transits south and sets in the west, so it sweeps
    // through several compass points over the night.
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      // The whole point of the header band: the letters sit above the plot,
      // never over the curve inside it.
      expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        frame.top + 1,
      )
    }
  })

  it('keeps a near-zenith transit label inside the chart', () => {
    // An object at the observer's declination culminates near 90°, driving the
    // transit label to the very top — where it used to clip off the viewBox.
    const overhead: SkyObject = {
      id: 'overhead',
      name: 'Overhead',
      kind: 'deep-sky',
      ra: 22,
      dec: KYIV.latitude,
    }
    const model = altitudeChartModel({
      object: overhead,
      location: KYIV,
      date: DATE,
    })
    const { container } = render(AltitudeChart, { model })
    const svg = container.querySelector('svg')!

    expect(model.peak!.altitude).toBeGreaterThan(85)
    const label = svg.querySelector('.peak-label')!.getBoundingClientRect()
    const box = svg.getBoundingClientRect()
    expect(label.top).toBeGreaterThanOrEqual(box.top - 1)
  })

  it('scrubs to the clicked moment of the night', () => {
    let scrubbed: number | null = null
    const model = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
    })
    const { container } = render(AltitudeChart, {
      model,
      onScrub: (minutes: number) => (scrubbed = minutes),
    })
    const svg = container.querySelector('svg')!
    const frame = svg.querySelector('.frame')!.getBoundingClientRect()

    // A click at the horizontal centre of the plot is local midnight — half of
    // a 1440-minute window in.
    svg.dispatchEvent(
      new MouseEvent('click', {
        clientX: frame.left + frame.width / 2,
        clientY: frame.top + frame.height / 2,
        bubbles: true,
      }),
    )

    expect(scrubbed).not.toBeNull()
    expect(scrubbed!).toBeGreaterThan(700)
    expect(scrubbed!).toBeLessThan(740)
  })

  it('draws the Moon track and phase glyph when asked', () => {
    const model = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
      includeMoon: true,
    })
    const { container } = render(AltitudeChart, { model })

    expect(container.querySelector('.moon-track')).not.toBeNull()
    // The glyph is drawn only when the Moon is up at its high point.
    if (model.moon!.peak && model.moon!.peak.altitude > 0) {
      expect(container.querySelector('.moon-glyph')).not.toBeNull()
    }
  })

  it('draws the phase glyph but no companion track when the Moon is the target', async () => {
    const model = altitudeChartModel({
      object: MOON,
      location: KYIV,
      date: DATE,
    })
    const { container } = render(AltitudeChart, { model })

    // The Moon's own trajectory shows it — no dimmed overlay on top — but the
    // phase glyph still marks its high point.
    expect(container.querySelector('.moon-track')).toBeNull()
    if (model.moon!.peak && model.moon!.peak.altitude > 0) {
      expect(container.querySelector('.moon-glyph')).not.toBeNull()
    }

    await document.fonts.ready
    await screenshot(
      'altitude-chart-moon-target',
      container.querySelector('.chart')!,
    )
  })

  it('captures the chart for comparison against altitude.png', async () => {
    const { container } = renderChart()

    await document.fonts.ready
    await screenshot('altitude-chart', container.querySelector('.chart')!)
  })
})

/** Rough relative brightness of an `rgb(...)` string; ordering is all we need. */
function luminance(color: string): number {
  const [r, g, b] = color.match(/\d+/g)!.map(Number)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
