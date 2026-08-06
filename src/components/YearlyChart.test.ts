/**
 * Structural checks on the rendered SVG. Geometry that depends on real layout
 * belongs to `src/visual/`.
 */

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import YearlyChart from './YearlyChart.svelte'
import type { GeoLocation } from '../lib/astro/types'
import { yearlyChartModel } from '../lib/charts'
import { FLAT_HORIZON } from '../lib/horizon'
import { objectByDesignation } from '../lib/catalog'
import { MOON } from '../lib/astro/moon'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const M13 = objectByDesignation('M13')!

function model(
  overrides: Partial<Parameters<typeof yearlyChartModel>[0]> = {},
) {
  return yearlyChartModel({
    object: M13,
    location: KYIV,
    year: 2026,
    date: new Date(2026, 6, 15),
    ...overrides,
  })
}

function renderChart(overrides = {}, props: Record<string, unknown> = {}) {
  const { container } = render(YearlyChart, {
    model: model(overrides),
    location: KYIV,
    horizon: FLAT_HORIZON,
    ...props,
  })
  return container.querySelector('svg')!
}

describe('YearlyChart', () => {
  it('draws one trajectory path through every sampled point', () => {
    const svg = renderChart()
    const paths = svg.querySelectorAll('.trajectory')
    expect(paths).toHaveLength(1)
  })

  it("draws no horizon or Moon elements on the yearly plot itself — that's the nightly chart's job", () => {
    const svg = renderChart()
    expect(svg.querySelectorAll('[class*="horizon"]')).toHaveLength(0)
    expect(svg.querySelectorAll('[class*="moon"]')).toHaveLength(0)
  })

  it('labels all twelve months', () => {
    const labels = [...renderChart().querySelectorAll('.month-label')].map(
      (t) => t.textContent,
    )
    expect(labels).toHaveLength(12)
    expect(labels[0]).toMatch(/jan/i)
    expect(labels[11]).toMatch(/dec/i)
  })

  it('draws a peak marker when the object rises', () => {
    const svg = renderChart()
    expect(svg.querySelectorAll('.peak')).toHaveLength(1)
  })

  it('draws a marker at the current date by default', () => {
    const svg = renderChart()
    expect(svg.querySelectorAll('.marker')).toHaveLength(1)
    expect(svg.querySelectorAll('.marker-line')).toHaveLength(1)
  })

  it('defaults the marker to the first day of the year when the model has no current date', () => {
    const svg = renderChart({ date: undefined })
    expect(svg.querySelectorAll('.marker')).toHaveLength(1)
    expect(svg.querySelectorAll('.marker-line')).toHaveLength(1)
  })

  it('renders a slider that lets any day of the year be selected', () => {
    const { container } = render(YearlyChart, {
      model: model(),
      location: KYIV,
      horizon: FLAT_HORIZON,
    })
    const slider = container.querySelector('input[type="range"]')
    expect(slider).not.toBeNull()
    expect(slider?.getAttribute('max')).toBe(
      String(model().points.length - 1),
    )
  })

  it('renders the Moon with the same daily cadence as a fixed object', () => {
    const moonModel = yearlyChartModel({
      object: MOON,
      location: KYIV,
      year: 2026,
    })
    expect(moonModel.points.length).toBe(model().points.length)
    const { container } = render(YearlyChart, {
      model: moonModel,
      location: KYIV,
      horizon: FLAT_HORIZON,
    })
    // The yearly plot's own trajectory — the nightly preview chart draws a
    // second one, for the selected night.
    expect(container.querySelector('svg')!.querySelectorAll('.trajectory'))
      .toHaveLength(1)
  })

  it('renders a nightly preview chart for the day the slider currently selects', () => {
    const { container } = render(YearlyChart, {
      model: model(),
      location: KYIV,
      horizon: FLAT_HORIZON,
    })
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(2)
    const nightly = svgs[1]
    // Horizon and Moon are drawn on the nightly chart...
    expect(nightly.querySelectorAll('.horizon-line')).toHaveLength(1)
    expect(nightly.querySelectorAll('[class*="moon"]').length).toBeGreaterThan(
      0,
    )
    // ...but there is no time-of-night marker, unlike the Results tab's chart.
    expect(nightly.querySelectorAll('.marker')).toHaveLength(0)
  })

  it('omits the Moon from the nightly preview when told to', () => {
    const { container } = render(YearlyChart, {
      model: model(),
      location: KYIV,
      horizon: FLAT_HORIZON,
      includeMoon: false,
    })
    const nightly = container.querySelectorAll('svg')[1]
    expect(nightly.querySelectorAll('[class*="moon"]')).toHaveLength(0)
  })
})
