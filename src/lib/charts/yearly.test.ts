import { describe, expect, it } from 'vitest'
import { MOON } from '../astro/moon'
import type { DeepSkyObject, GeoLocation } from '../astro/types'
import { monthTicks, yearlyChartModel } from './yearly'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const HIGH_ARCTIC: GeoLocation = { latitude: 80, longitude: 0 }

const M13: DeepSkyObject = {
  id: 'M13',
  name: 'M13',
  kind: 'deep-sky',
  ra: 16.69479,
  dec: 36.45986,
}

// From 80°N, M13's highest altitude is 90 − 80 + 36.46 − 90 < 0 — never rises.
const M104: DeepSkyObject = {
  id: 'M104',
  name: 'M104',
  kind: 'deep-sky',
  ra: 12.6665,
  dec: -11.62306,
}

describe('monthTicks', () => {
  it('returns twelve ticks, one per month, labelled Jan through Dec', () => {
    const ticks = monthTicks(2026)
    expect(ticks).toHaveLength(12)
    expect(ticks.map((t) => t.time.getMonth())).toEqual([...Array(12).keys()])
    expect(ticks[0].label).toMatch(/jan/i)
    expect(ticks[11].label).toMatch(/dec/i)
  })

  it('anchors every tick on the 1st at local midnight', () => {
    for (const tick of monthTicks(2026)) {
      expect(tick.time.getDate()).toBe(1)
      expect(tick.time.getHours()).toBe(0)
    }
  })
})

describe('yearlyChartModel', () => {
  it('samples every day of the year', () => {
    const model = yearlyChartModel({ object: M13, location: KYIV, year: 2026 })
    expect(model.points.length).toBe(365)
  })

  it('samples daily for the Moon too', () => {
    const model = yearlyChartModel({ object: MOON, location: KYIV, year: 2026 })
    expect(model.points.length).toBe(365)
  })

  it('picks the highest sample as the peak', () => {
    const model = yearlyChartModel({ object: M13, location: KYIV, year: 2026 })
    const maxAltitude = Math.max(...model.points.map((p) => p.altitude))
    expect(model.peak?.altitude).toBe(maxAltitude)
  })

  it('still returns a (flat, below-horizon) curve for an object that never rises', () => {
    const model = yearlyChartModel({
      object: M104,
      location: HIGH_ARCTIC,
      year: 2026,
    })
    expect(model.points.length).toBeGreaterThan(0)
    expect(model.points.every((p) => p.altitude < 0)).toBe(true)
    expect(model.peak).not.toBeNull()
  })

  it('resolves `current` to the sample nearest the reference date', () => {
    const model = yearlyChartModel({
      object: M13,
      location: KYIV,
      year: 2026,
      date: new Date(2026, 6, 15),
    })
    expect(model.current).not.toBeNull()
    const target = new Date(2026, 6, 15).getTime()
    const closestGap = Math.min(
      ...model.points.map((p) => Math.abs(p.time.getTime() - target)),
    )
    expect(Math.abs(model.current!.time.getTime() - target)).toBe(closestGap)
  })

  it('leaves `current` null when no reference date is given', () => {
    const model = yearlyChartModel({ object: M13, location: KYIV, year: 2026 })
    expect(model.current).toBeNull()
  })
})
