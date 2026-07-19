import { describe, expect, it } from 'vitest'
import { nightWindow } from '../astro/time'
import {
  altitudeTicks,
  altitudeToY,
  areaPath,
  hourTicks,
  plotBottom,
  polylinePath,
  timeToX,
  type PlotArea,
} from './scales'

const PLOT: PlotArea = { left: 50, top: 10, width: 900, height: 300 }

describe('altitudeToY', () => {
  it('puts 0° on the baseline and 90° on the top edge', () => {
    expect(altitudeToY(0, PLOT)).toBe(plotBottom(PLOT))
    expect(altitudeToY(90, PLOT)).toBe(PLOT.top)
  })

  it('is linear in between', () => {
    expect(altitudeToY(45, PLOT)).toBe(160)
    expect(altitudeToY(30, PLOT)).toBe(210)
  })

  it('clamps a set object onto the baseline instead of dropping it', () => {
    // The curve must stay continuous while the object is below the horizon —
    // the reference rendering runs it flat along 0° rather than breaking it.
    expect(altitudeToY(-20, PLOT)).toBe(plotBottom(PLOT))
    expect(altitudeToY(120, PLOT)).toBe(PLOT.top)
  })
})

describe('timeToX', () => {
  const window = nightWindow(new Date(2026, 6, 18))

  it('maps the window ends to the plot edges', () => {
    expect(timeToX(window.start, window, PLOT)).toBe(PLOT.left)
    expect(timeToX(window.end, window, PLOT)).toBe(PLOT.left + PLOT.width)
  })

  it('puts local midnight at the centre', () => {
    expect(timeToX(window.midnight, window, PLOT)).toBeCloseTo(500, 6)
  })

  it('clamps times outside the window to the edges', () => {
    const before = new Date(window.start.getTime() - 3_600_000)
    const after = new Date(window.end.getTime() + 3_600_000)
    expect(timeToX(before, window, PLOT)).toBe(PLOT.left)
    expect(timeToX(after, window, PLOT)).toBe(PLOT.left + PLOT.width)
  })
})

describe('hourTicks', () => {
  it('runs from noon to noon every three hours', () => {
    const window = nightWindow(new Date(2026, 6, 18))
    const ticks = hourTicks(window)

    expect(ticks.map((t) => t.getHours())).toEqual([
      12, 15, 18, 21, 0, 3, 6, 9, 12,
    ])
  })

  it('honours a different step', () => {
    const window = nightWindow(new Date(2026, 6, 18))
    expect(hourTicks(window, 6).map((t) => t.getHours())).toEqual([
      12, 18, 0, 6, 12,
    ])
  })

  it('lands on whole local hours, not on multiples of the step in ms', () => {
    const window = nightWindow(new Date(2026, 6, 18))
    for (const tick of hourTicks(window)) {
      expect(tick.getMinutes()).toBe(0)
      expect(tick.getSeconds()).toBe(0)
    }
  })
})

describe('altitudeTicks', () => {
  it('covers 0 to 90 inclusive', () => {
    expect(altitudeTicks()).toEqual([0, 30, 60, 90])
    expect(altitudeTicks(45)).toEqual([0, 45, 90])
  })
})

describe('paths', () => {
  const points = [
    { x: 0, y: 10 },
    { x: 5, y: 20 },
    { x: 10, y: 15 },
  ]

  it('builds an open polyline', () => {
    expect(polylinePath(points)).toBe('M0 10 L5 20 L10 15')
  })

  it('closes an area down to the baseline', () => {
    expect(areaPath(points, 100)).toBe('M0 10 L5 20 L10 15 L10 100 L0 100 Z')
  })

  it('yields nothing for no points rather than a broken path', () => {
    expect(polylinePath([])).toBe('')
    expect(areaPath([], 100)).toBe('')
  })
})
