import { describe, expect, it } from 'vitest'
import { computeObjectEvents } from './events'
import {
  hoursAboveAltitude,
  hoursAboveHorizon,
  observingWindow,
} from './observability'
import { nightWindow, windowHours } from './time'
import type { DeepSkyObject, GeoLocation } from './types'
import { FLAT_HORIZON, Horizon } from '../horizon'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const WINDOW = nightWindow(new Date(2026, 0, 15))

/** A fixed star at the given declination; right ascension is immaterial here. */
function star(dec: number): DeepSkyObject {
  return { id: 'star', name: 'star', kind: 'deep-sky', ra: 6, dec }
}

describe('hoursAboveAltitude', () => {
  it('counts nearly the whole window for a circumpolar object', () => {
    // At +80° from latitude 50° the star never dips below ~20°, so it clears
    // 10° for essentially the entire window.
    const hours = hoursAboveAltitude(star(80), KYIV, WINDOW, 10)
    expect(hours).toBeCloseTo(windowHours(WINDOW), 1)
  })

  it('is zero for an object that never rises', () => {
    // At −80° from the northern hemisphere the star stays below the horizon.
    expect(hoursAboveAltitude(star(-80), KYIV, WINDOW, 0)).toBe(0)
  })

  it('reports less time the higher the threshold', () => {
    const object = star(20)
    const above10 = hoursAboveAltitude(object, KYIV, WINDOW, 10)
    const above40 = hoursAboveAltitude(object, KYIV, WINDOW, 40)
    expect(above10).toBeGreaterThan(above40)
    expect(above40).toBeGreaterThanOrEqual(0)
  })
})

describe('hoursAboveHorizon', () => {
  it('matches the altitude count for a flat horizon at 0°', () => {
    const object = star(20)
    const byHorizon = hoursAboveHorizon(object, KYIV, WINDOW, FLAT_HORIZON)
    const byAltitude = hoursAboveAltitude(object, KYIV, WINDOW, 0)
    expect(byHorizon).toBeCloseTo(byAltitude, 5)
  })

  it('matches the altitude count for a flat horizon raised to 30°', () => {
    // A single-point horizon reads that altitude in every direction.
    const raised = new Horizon([{ azimuth: 0, altitude: 30 }])
    const object = star(25)
    const byHorizon = hoursAboveHorizon(object, KYIV, WINDOW, raised)
    const byAltitude = hoursAboveAltitude(object, KYIV, WINDOW, 30)
    expect(byHorizon).toBeCloseTo(byAltitude, 5)
  })

  it('agrees with the bisected event spans within sampling error', () => {
    const object = star(10)
    const hours = hoursAboveHorizon(object, KYIV, WINDOW, FLAT_HORIZON)

    const { spans } = computeObjectEvents({
      object,
      location: KYIV,
      window: WINDOW,
      horizon: FLAT_HORIZON,
    })
    const spanHours = spans.reduce(
      (total, span) =>
        total +
        (span.end.time.getTime() - span.start.time.getTime()) / 3_600_000,
      0,
    )

    expect(hours).toBeCloseTo(spanHours, 1)
  })
})

describe('observingWindow', () => {
  it('is the whole night when not restricted to darkness', () => {
    expect(observingWindow(new Date(2026, 0, 15), KYIV, false)).toEqual(WINDOW)
  })

  it('is the sunset→sunrise stretch when restricted to darkness', () => {
    const full = nightWindow(new Date(2026, 0, 15))
    const night = observingWindow(new Date(2026, 0, 15), KYIV, true)!

    expect(night.start.getTime()).toBeGreaterThan(full.start.getTime())
    expect(night.end.getTime()).toBeLessThan(full.end.getTime())
    expect(night.start.getTime()).toBeLessThan(night.end.getTime())
  })

  it('counts less time above the horizon at night than across the whole day', () => {
    const date = new Date(2026, 0, 15)
    const object = star(20)
    const full = hoursAboveHorizon(
      object,
      KYIV,
      nightWindow(date),
      FLAT_HORIZON,
    )
    const night = hoursAboveHorizon(
      object,
      KYIV,
      observingWindow(date, KYIV, true)!,
      FLAT_HORIZON,
    )
    expect(night).toBeLessThan(full)
  })

  it('has no night to observe in during a polar day', () => {
    // Far north at midsummer: the sun never sets.
    const arctic: GeoLocation = { latitude: 80, longitude: 20 }
    expect(observingWindow(new Date(2026, 5, 21), arctic, true)).toBeNull()
  })

  it('treats the whole window as night during a polar night', () => {
    // Far north at midwinter: the sun never rises.
    const arctic: GeoLocation = { latitude: 80, longitude: 20 }
    const date = new Date(2026, 11, 21)
    expect(observingWindow(date, arctic, true)).toEqual(nightWindow(date))
  })
})
