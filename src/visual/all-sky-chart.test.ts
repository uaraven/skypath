/**
 * All-sky chart geometry, measured in a real browser.
 *
 * The polar projection is the part of this chart most easily wrong in a way
 * that stays self-consistent — mirrored east/west, or rotated so north is no
 * longer up — and jsdom cannot tell, because it never resolves a viewBox into
 * screen coordinates. These tests measure where the browser actually painted.
 */

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AllSkyChart from '../components/AllSkyChart.svelte'
import type { GeoLocation } from '../lib/astro/types'
import { MOON, objectByDesignation } from '../lib/catalog'
import { allSkyChartModel } from '../lib/charts'
import { horizonFromText } from '../lib/horizon'
import carrHorizon from '../lib/horizon/fixtures/e.c.carr-horizon.txt?raw'
import { screenshot } from './screenshot'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const DATE = new Date(2026, 9, 15)
const M13 = objectByDesignation('M13')!

function renderChart() {
  const model = allSkyChartModel({
    object: M13,
    location: KYIV,
    date: DATE,
    horizon: horizonFromText(carrHorizon),
  })
  const { container } = render(AllSkyChart, { model })
  return { container, svg: container.querySelector('svg')!, model }
}

function centre(element: Element): { x: number; y: number } {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** The painted rim: centre and radius, in screen pixels. */
function rim(svg: SVGSVGElement) {
  const box = svg.querySelector('circle.frame')!.getBoundingClientRect()
  return {
    ...centre(svg.querySelector('circle.frame')!),
    radius: box.width / 2,
  }
}

describe('all-sky chart geometry', () => {
  it('paints a round dial, not an ellipse', () => {
    // The SVG is square and `preserveAspectRatio` keeps it so; a stretched
    // dial would silently distort every azimuth on it.
    const box = renderChart()
      .svg.querySelector('circle.frame')!
      .getBoundingClientRect()

    expect(box.width).toBeCloseTo(box.height, 0)
  })

  it('paints the culmination at the radius its altitude claims', () => {
    const { svg, model } = renderChart()

    const dial = rim(svg)
    const peak = centre(svg.querySelector('circle.peak')!)
    const distance = Math.hypot(peak.x - dial.x, peak.y - dial.y)

    // Zenith at the centre, horizon at the rim: ~76° sits near the middle.
    expect(distance / dial.radius).toBeCloseTo(1 - model.peak!.altitude / 90, 1)
  })

  it('paints the culmination due south of the centre', () => {
    const { svg } = renderChart()

    const dial = rim(svg)
    const peak = centre(svg.querySelector('circle.peak')!)

    // South is straight down the dial. This is the assertion that fails if the
    // projection is mirrored or rotated.
    expect(peak.x).toBeCloseTo(dial.x, 0)
    expect(peak.y).toBeGreaterThan(dial.y)
  })

  it('paints the cardinal labels at the four compass directions', () => {
    const { svg } = renderChart()

    const dial = rim(svg)
    const label = (text: string) =>
      centre(
        [...svg.querySelectorAll('.azimuth-label')].find(
          (l) => l.textContent === text,
        )!,
      )

    const north = label('N')
    const south = label('S')
    const east = label('E')
    const west = label('W')

    expect(north.y).toBeLessThan(dial.y - dial.radius)
    expect(south.y).toBeGreaterThan(dial.y + dial.radius)
    expect(east.x).toBeGreaterThan(dial.x + dial.radius)
    expect(west.x).toBeLessThan(dial.x - dial.radius)
    expect(north.x).toBeCloseTo(south.x, 0)
    expect(east.y).toBeCloseTo(west.y, 0)
  })

  it('keeps the whole track inside the rim', () => {
    const { svg } = renderChart()

    const dial = rim(svg)
    // `getBoundingClientRect` reports the geometry a stroke is centred on, so
    // half a stroke width legitimately sticks out past the rim.
    const tolerance = 3

    for (const path of svg.querySelectorAll('.trajectory')) {
      const box = path.getBoundingClientRect()
      for (const corner of [
        { x: box.left, y: box.top },
        { x: box.right, y: box.bottom },
      ]) {
        expect(Math.hypot(corner.x - dial.x, corner.y - dial.y)).toBeLessThan(
          dial.radius * Math.SQRT2 + tolerance,
        )
      }
      expect(box.left).toBeGreaterThanOrEqual(dial.x - dial.radius - tolerance)
      expect(box.right).toBeLessThanOrEqual(dial.x + dial.radius + tolerance)
    }
  })

  it('wraps the obstruction ring right round the rim', () => {
    const { svg } = renderChart()

    const dial = rim(svg)
    const fill = svg.querySelector('.horizon-fill')!.getBoundingClientRect()

    // The Carr horizon obstructs every azimuth, so the ring spans the full
    // disc — a wrap segment dropped at north would leave a notch instead.
    expect(fill.width).toBeCloseTo(dial.radius * 2, 0)
    expect(fill.height).toBeCloseTo(dial.radius * 2, 0)
  })

  it('renders the labels in the mono face, not a fallback', async () => {
    const { svg } = renderChart()

    await document.fonts.ready
    const label = svg.querySelector('.azimuth-label')!
    expect(getComputedStyle(label).fontFamily).toContain('Fira Code')
  })

  it('draws the Moon arc and phase glyph when asked', () => {
    const model = allSkyChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
      horizon: horizonFromText(carrHorizon),
      includeMoon: true,
    })
    const { container } = render(AllSkyChart, { model })

    expect(container.querySelector('.moon-track')).not.toBeNull()
    if (model.moon!.peak && model.moon!.peak.altitude > 0) {
      expect(container.querySelector('.moon-glyph')).not.toBeNull()
    }
  })

  it('draws the phase glyph but no companion track when the Moon is the target', () => {
    const model = allSkyChartModel({
      object: MOON,
      location: KYIV,
      date: DATE,
      horizon: horizonFromText(carrHorizon),
    })
    const { container } = render(AllSkyChart, { model })

    expect(container.querySelector('.moon-track')).toBeNull()
    if (model.moon!.peak && model.moon!.peak.altitude > 0) {
      expect(container.querySelector('.moon-glyph')).not.toBeNull()
    }
  })

  it('captures the chart for comparison against azimutal.png', async () => {
    const { svg } = renderChart()

    // Blown up past the layout cap: the screenshot provider downscales what it
    // saves, and `azimutal.png` is a large image. Shooting the dial at its CSS
    // size would produce a thumbnail nothing could be judged from.
    svg.style.maxWidth = 'none'
    svg.style.width = '900px'
    await document.fonts.ready
    await screenshot('all-sky-chart', svg)
  })
})
