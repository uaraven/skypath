/**
 * Structural checks on the rendered SVG. Geometry that depends on real layout
 * belongs to `src/visual/`.
 */

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import YearlyChart from './YearlyChart.svelte'
import type { GeoLocation } from '../lib/astro/types'
import { yearlyChartModel } from '../lib/charts'
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

function renderChart(overrides = {}) {
  const { container } = render(YearlyChart, { model: model(overrides) })
  return container.querySelector('svg')!
}

describe('YearlyChart', () => {
  it('draws one trajectory path through every sampled point', () => {
    const svg = renderChart()
    const paths = svg.querySelectorAll('.trajectory')
    expect(paths).toHaveLength(1)
  })

  it('draws no horizon or Moon elements — this chart has neither', () => {
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

  it('draws a "current" marker when the model has one', () => {
    const svg = renderChart()
    expect(svg.querySelectorAll('.current')).toHaveLength(1)
    expect(svg.querySelectorAll('.current-line')).toHaveLength(1)
  })

  it('omits the "current" marker when the model has none', () => {
    const svg = renderChart({ date: undefined })
    expect(svg.querySelectorAll('.current')).toHaveLength(0)
    expect(svg.querySelectorAll('.current-line')).toHaveLength(0)
  })

  it('renders the Moon with the same daily cadence as a fixed object', () => {
    const moonModel = yearlyChartModel({
      object: MOON,
      location: KYIV,
      year: 2026,
    })
    expect(moonModel.points.length).toBe(model().points.length)
    // Still just one polyline — the component doesn't assume a point count.
    const { container } = render(YearlyChart, { model: moonModel })
    expect(container.querySelectorAll('.trajectory')).toHaveLength(1)
  })
})
