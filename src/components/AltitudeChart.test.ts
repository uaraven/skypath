/**
 * Structural checks on the rendered SVG. Geometry that depends on real layout
 * (aspect ratio, visibility, fonts) belongs to `src/visual/`.
 */

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AltitudeChart from './AltitudeChart.svelte'
import type { GeoLocation } from '../lib/astro/types'
import { altitudeChartModel } from '../lib/charts'
import { objectByDesignation } from '../lib/catalog'
import { horizonFromText } from '../lib/horizon'
import carrHorizon from '../lib/horizon/fixtures/e.c.carr-horizon.txt?raw'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const LONGYEARBYEN: GeoLocation = { latitude: 78.22, longitude: 15.65 }
const M13 = objectByDesignation('M13')!
const NUMBERS = /[\d.]+/g

function model(
  overrides: Partial<Parameters<typeof altitudeChartModel>[0]> = {},
) {
  return altitudeChartModel({
    object: M13,
    location: KYIV,
    date: new Date(2026, 9, 15),
    horizon: horizonFromText(carrHorizon),
    ...overrides,
  })
}

function renderChart(overrides = {}, props: Record<string, unknown> = {}) {
  const { container } = render(AltitudeChart, {
    model: model(overrides),
    ...props,
  })
  return container.querySelector('svg')!
}

describe('AltitudeChart', () => {
  it('draws one rect per twilight band, in phase order', () => {
    const svg = renderChart()

    const phases = [...svg.querySelectorAll('rect.band')].map((rect) =>
      rect.getAttribute('data-phase'),
    )

    expect(phases).toEqual([
      'day',
      'civil',
      'nautical',
      'astronomical',
      'night',
      'astronomical',
      'nautical',
      'civil',
      'day',
    ])
  })

  it('shades polar day as a single band', () => {
    const svg = renderChart({
      location: LONGYEARBYEN,
      date: new Date(2026, 5, 21),
    })

    const bands = svg.querySelectorAll('rect.band')
    expect(bands).toHaveLength(1)
    expect(bands[0].getAttribute('data-phase')).toBe('day')
  })

  it('draws the trajectory and the horizon as separate paths', () => {
    const svg = renderChart()

    for (const selector of ['.trajectory', '.horizon-line', '.horizon-fill']) {
      const path = svg.querySelector(selector)!
      expect(path.getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+ L/)
    }
  })

  it('closes the horizon area down to the baseline so it reads as a silhouette', () => {
    const svg = renderChart()

    expect(svg.querySelector('.horizon-fill')!.getAttribute('d')).toMatch(/Z$/)
    expect(svg.querySelector('.horizon-line')!.getAttribute('d')).not.toMatch(
      /Z$/,
    )
  })

  it('labels the time axis noon to noon and the altitude axis 0–90°', () => {
    const svg = renderChart()

    const hours = [...svg.querySelectorAll('.time-label')].map(
      (t) => t.textContent,
    )
    expect(hours).toEqual([
      '12',
      '15',
      '18',
      '21',
      '00',
      '03',
      '06',
      '09',
      '12',
    ])

    const altitudes = [...svg.querySelectorAll('.altitude-label')].map(
      (t) => t.textContent,
    )
    expect(altitudes).toEqual(['0', '30', '60', '90'])
  })

  it('marks the culmination with its altitude', () => {
    const svg = renderChart()

    expect(svg.querySelector('circle.peak')).not.toBeNull()
    expect(svg.querySelector('.peak-label')!.textContent).toBe('76°')
  })

  it('describes the night in the accessible label', () => {
    const svg = renderChart()

    expect(svg.getAttribute('aria-label')).toMatch(
      /Messier 13|M 13|peaks at 76°/,
    )
    expect(svg.getAttribute('role')).toBe('img')
  })

  it('draws no time indicator until one is asked for', () => {
    expect(renderChart().querySelector('.marker')).toBeNull()
  })

  it('puts the time indicator on the curve at the given moment', () => {
    const midnight = new Date(2026, 9, 16, 0, 0)
    const svg = renderChart({}, { markerTime: midnight })

    const apex = svg
      .querySelector('.marker')!
      .getAttribute('d')!
      .match(NUMBERS)!
    const line = svg.querySelector('.marker-line')!

    // The apex sits where the trajectory is at that time, and the guide line
    // stands at the same x — that pairing is the whole point of the indicator.
    expect(Number(apex[0])).toBeCloseTo(Number(line.getAttribute('x1')), 6)
    expect(svg.getAttribute('aria-label')).toContain('at 00:00')
  })

  it('ignores a time outside the night window', () => {
    const svg = renderChart({}, { markerTime: new Date(2026, 9, 20, 0, 0) })

    expect(svg.querySelector('.marker')).toBeNull()
    expect(svg.querySelector('.marker-line')).toBeNull()
  })

  it('omits the peak marker for an object that never rises', () => {
    const southern = {
      id: 'test-southern',
      name: 'Southern test object',
      kind: 'deep-sky' as const,
      ra: 6,
      dec: -80,
    }
    const svg = renderChart({ object: southern })

    expect(svg.querySelector('circle.peak')).toBeNull()
    expect(svg.getAttribute('aria-label')).toContain('below the horizon')
  })
})
