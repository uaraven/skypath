/**
 * Structural checks on the rendered SVG. Geometry that depends on real layout
 * (aspect ratio, visibility, fonts) belongs to `src/visual/`.
 */

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AllSkyChart from './AllSkyChart.svelte'
import type { GeoLocation } from '../lib/astro/types'
import { allSkyChartModel } from '../lib/charts'
import { objectByDesignation } from '../lib/catalog'
import { horizonFromText } from '../lib/horizon'
import carrHorizon from '../lib/horizon/fixtures/e.c.carr-horizon.txt?raw'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const M13 = objectByDesignation('M13')!

function model(
  overrides: Partial<Parameters<typeof allSkyChartModel>[0]> = {},
) {
  return allSkyChartModel({
    object: M13,
    location: KYIV,
    date: new Date(2026, 9, 15),
    horizon: horizonFromText(carrHorizon),
    ...overrides,
  })
}

function renderChart(overrides = {}, props: Record<string, unknown> = {}) {
  const { container } = render(AllSkyChart, {
    model: model(overrides),
    ...props,
  })
  return container.querySelector('svg')!
}

describe('AllSkyChart', () => {
  it('labels the cardinals and the intercardinal bearings', () => {
    const labels = [...renderChart().querySelectorAll('.azimuth-label')].map(
      (t) => t.textContent,
    )

    expect(labels).toEqual(['N', '45', 'E', '135', 'S', '225', 'W', '315'])
  })

  it('puts north at the top and east to the right', () => {
    // The whole chart rests on this orientation, and nothing else in the
    // markup would reveal it being mirrored or rotated.
    const svg = renderChart()
    const labels = [...svg.querySelectorAll('.azimuth-label')]
    const at = (text: string) => labels.find((l) => l.textContent === text)!
    const x = (text: string) => Number(at(text).getAttribute('x'))
    const y = (text: string) => Number(at(text).getAttribute('y'))

    expect(y('N')).toBeLessThan(y('S'))
    expect(x('E')).toBeGreaterThan(x('W'))
    expect(x('N')).toBeCloseTo(x('S'), 6)
    expect(y('E')).toBeCloseTo(y('W'), 6)
  })

  it('draws one path per pass above the horizon', () => {
    // M13 is up at local noon, sets, and rises again before the window ends.
    expect(renderChart().querySelectorAll('.trajectory')).toHaveLength(2)
  })

  it('punches the clear sky out of the obstruction ring', () => {
    const svg = renderChart()
    const fill = svg.querySelector('.horizon-fill')!

    // Without evenodd the disc and the hole would union into a solid overlay
    // covering the entire dial.
    expect(fill.getAttribute('fill-rule')).toBe('evenodd')
    expect(fill.getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+ A/)
    expect(svg.querySelector('.horizon-line')!.getAttribute('d')).toMatch(/Z$/)
  })

  it('rings the dial with altitude circles inside the rim', () => {
    const svg = renderChart()
    const radii = [...svg.querySelectorAll('circle.grid')].map((c) =>
      Number(c.getAttribute('r')),
    )
    const rim = Number(svg.querySelector('circle.frame')!.getAttribute('r'))

    expect(radii).toHaveLength(5)
    expect(Math.max(...radii)).toBeLessThan(rim)
    expect(Math.min(...radii)).toBeGreaterThan(0)
  })

  it('marks whole hours and labels every third one', () => {
    const svg = renderChart()

    const marks = svg.querySelectorAll('circle.hour')
    // Labels carry the locale clock (e.g. "3 PM" under en-US), so read the
    // leading hour number off the text. Every-third-hour holds on both clocks:
    // the labelled 24-h hours 0/3/…/21 map to 12-h 12/3/6/9, all multiples of 3.
    const labels = [...svg.querySelectorAll('.hour-label')].map((t) =>
      Number(t.textContent!.match(/\d+/)![0]),
    )

    expect(marks.length).toBeGreaterThan(labels.length)
    expect(labels.every((hour) => hour % 3 === 0)).toBe(true)
  })

  it('gives each instance its own clip path', () => {
    // Two dials on one page would otherwise both clip to the first one's disc.
    const { container } = render(AllSkyChart, { model: model() })
    const second = render(AllSkyChart, { model: model() })

    const id = (root: ParentNode) =>
      root.querySelector('clipPath')!.getAttribute('id')

    expect(id(container)).not.toBe(id(second.container))
  })

  it('names the culmination direction in the accessible label', () => {
    const svg = renderChart()

    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toContain('peaks at 76° in the S')
  })

  it('says so when the horizon blocks the object all night', () => {
    const polaris = {
      id: 'polaris',
      name: 'Polaris',
      kind: 'deep-sky' as const,
      ra: 2.5303,
      dec: 89.2641,
    }
    const svg = renderChart({ object: polaris })

    // The Carr horizon reaches 61° due north-east but Polaris sits at ~50°
    // altitude due north, behind the 55° treeline.
    expect(svg.getAttribute('aria-label')).toContain(
      'never clears your horizon',
    )
    // Still drawn, though — being blocked is not being absent.
    expect(svg.querySelectorAll('.trajectory')).toHaveLength(1)
  })

  it('draws no time indicator until one is asked for', () => {
    expect(renderChart().querySelector('.marker')).toBeNull()
  })

  it('marks where the object is at the given moment', () => {
    // 20:00 — M13 is up and in the north-west from Kyiv.
    const svg = renderChart({}, { markerTime: new Date(2026, 9, 15, 20, 0) })

    expect(svg.querySelector('.marker')).not.toBeNull()
    expect(svg.getAttribute('aria-label')).toMatch(
      /at the marked time it is at \d+° in the NW/,
    )
  })

  // The dial has nothing below the rim to point at, and interpolating across
  // the gap between two arcs would sit the indicator on the rim all night.
  it('omits the indicator while the object is below the horizon', () => {
    // M13 sets at 23:26 and rises again at 02:38 on this night.
    const svg = renderChart({}, { markerTime: new Date(2026, 9, 16, 1, 0) })

    expect(svg.querySelector('.marker')).toBeNull()
    expect(svg.getAttribute('aria-label')).not.toContain('marked time')
  })

  it('draws no track for an object that never rises', () => {
    const southern = {
      id: 'test-southern',
      name: 'Southern test object',
      kind: 'deep-sky' as const,
      ra: 6,
      dec: -80,
    }
    const svg = renderChart({ object: southern })

    expect(svg.querySelectorAll('.trajectory')).toHaveLength(0)
    expect(svg.querySelector('circle.peak')).toBeNull()
    expect(svg.getAttribute('aria-label')).toContain('below the horizon')
  })
})
