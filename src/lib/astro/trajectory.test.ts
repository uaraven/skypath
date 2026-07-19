import { SearchHourAngle } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { toObserver, withEngineBody } from './ephemeris'
import { nightWindow } from './time'
import { peakAltitude, sampleTrajectory, trajectoryForDate } from './trajectory'
import type { DeepSkyObject, GeoLocation } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const HIGH_ARCTIC: GeoLocation = { latitude: 80, longitude: 0 }

const dso = (id: string, ra: number, dec: number): DeepSkyObject => ({
  id,
  name: id,
  kind: 'deep-sky',
  ra,
  dec,
})

const M13 = dso('M13', 16.69479, 36.45986)
const M81 = dso('M81', 9.92589, 69.06528)
const M104 = dso('M104', 12.6665, -11.62306)

const DATE = new Date(2026, 6, 18)

describe('sampleTrajectory', () => {
  it('covers the whole window at the requested step', () => {
    const { points } = trajectoryForDate(M13, KYIV, DATE, 5)

    expect(points).toHaveLength(24 * 12 + 1)
    expect(points[0].time).toEqual(nightWindow(DATE).start)
    expect(points[points.length - 1].time).toEqual(nightWindow(DATE).end)
  })

  it('reaches the window end even when the step does not divide it evenly', () => {
    const window = nightWindow(DATE)
    const { points } = sampleTrajectory(M13, KYIV, window, 7)

    expect(points[points.length - 1].time).toEqual(window.end)
  })

  it('advances monotonically in time', () => {
    const { points } = trajectoryForDate(M13, KYIV, DATE, 30)

    for (let i = 1; i < points.length; i++) {
      expect(points[i].time.getTime()).toBeGreaterThan(
        points[i - 1].time.getTime(),
      )
    }
  })

  it('keeps a circumpolar object above the horizon all night', () => {
    // From Kyiv, M81's lowest altitude is dec + lat − 90 ≈ 29°.
    const { points } = trajectoryForDate(M81, KYIV, DATE, 15)
    const lowest = Math.min(...points.map((p) => p.altitude))

    expect(lowest).toBeGreaterThan(25)
  })

  it('keeps a never-rising object below the horizon all night', () => {
    // From 80°N, M104's highest altitude is 90 − 80 − 11.6 < 0.
    const { points } = trajectoryForDate(M104, HIGH_ARCTIC, DATE, 15)

    expect(Math.max(...points.map((p) => p.altitude))).toBeLessThan(0)
  })
})

describe('peakAltitude', () => {
  it('finds the sample nearest the object culmination', () => {
    const trajectory = trajectoryForDate(M13, KYIV, DATE, 1)
    const peak = peakAltitude(trajectory)!

    const observer = toObserver(KYIV)
    const transit = withEngineBody(M13, (body) =>
      SearchHourAngle(body, observer, 0, nightWindow(DATE).start),
    )

    // Sampled at 1-minute steps, so the peak sample sits within a minute of
    // the true culmination.
    const offset = Math.abs(peak.time.getTime() - transit.time.date.getTime())
    expect(offset).toBeLessThanOrEqual(60_000)
    expect(peak.altitude).toBeCloseTo(transit.hor.altitude, 2)
  })

  it('returns null for an empty trajectory', () => {
    expect(
      peakAltitude({ object: M13, window: nightWindow(DATE), points: [] }),
    ).toBeNull()
  })
})
