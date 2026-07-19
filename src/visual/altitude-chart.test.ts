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
import type { GeoLocation } from '../lib/astro/types'
import { objectByDesignation } from '../lib/catalog'
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
