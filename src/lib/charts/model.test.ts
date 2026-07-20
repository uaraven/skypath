import { describe, expect, it } from 'vitest'
import type { GeoLocation, SkyObject } from '../astro/types'
import { objectByDesignation } from '../catalog'
import { Horizon, horizonFromText } from '../horizon'
import carrHorizon from '../horizon/fixtures/e.c.carr-horizon.txt?raw'
import type { TrajectoryPoint } from '../astro/types'
import { altitudeChartModel, cardinalCrossings, everVisible } from './model'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const DATE = new Date(2026, 9, 15)

const M13 = objectByDesignation('M13')!
const POLARIS: SkyObject = {
  id: 'polaris',
  name: 'Polaris',
  kind: 'deep-sky',
  ra: 2.5303,
  dec: 89.2641,
}

describe('altitudeChartModel', () => {
  it('samples the trajectory and the horizon on the same time grid', () => {
    const model = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
    })

    expect(model.points.length).toBeGreaterThan(200)
    expect(model.horizonTrack).toHaveLength(model.points.length)
    for (let i = 0; i < model.points.length; i++) {
      expect(model.horizonTrack[i].time).toEqual(model.points[i].time)
    }
  })

  it('tracks the horizon along the object’s azimuth, not a fixed direction', () => {
    // The Carr horizon varies with azimuth, so an object that swings across
    // the sky must see different obstruction heights over the night.
    const horizon = horizonFromText(carrHorizon)
    const model = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
      horizon,
    })

    const altitudes = new Set(model.horizonTrack.map((s) => s.altitude))
    expect(altitudes.size).toBeGreaterThan(10)

    for (let i = 0; i < model.points.length; i++) {
      expect(model.horizonTrack[i].altitude).toBeCloseTo(
        horizon.altitudeAt(model.points[i].azimuth),
        10,
      )
    }
  })

  it('defaults to a flat horizon when the observatory has none', () => {
    const model = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
    })

    expect(model.horizonTrack.every((s) => s.altitude === 0)).toBe(true)
  })

  it('reports the peak at the culmination altitude for the latitude', () => {
    const model = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
    })

    // Culmination altitude = 90 − |latitude − declination|; M13 sits at
    // dec +36.46°, so from Kyiv it tops out near 76°.
    expect(model.peak!.altitude).toBeCloseTo(76, 0)
    // ...due south. The peak is the highest *sample*, so at a 5-minute step it
    // can sit a couple of minutes either side of the meridian — about 0.7° of
    // azimuth at this latitude. Exact culmination is Phase 6's job.
    expect(Math.abs(model.peak!.azimuth - 180)).toBeLessThan(1)
  })

  it('leaves the Moon out unless asked, and includes it when asked', () => {
    const without = altitudeChartModel({ object: M13, location: KYIV, date: DATE })
    expect(without.moon).toBeNull()

    const withMoon = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
      includeMoon: true,
    })
    expect(withMoon.moon).not.toBeNull()
    expect(withMoon.moon!.points).toHaveLength(withMoon.points.length)
    expect(withMoon.moon!.illumination).toBeGreaterThanOrEqual(0)
    expect(withMoon.moon!.illumination).toBeLessThanOrEqual(1)
  })

  it('shades the same window the trajectory spans', () => {
    const model = altitudeChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
    })

    expect(model.bands[0].start).toEqual(model.window.start)
    expect(model.bands[model.bands.length - 1].end).toEqual(model.window.end)
  })
})

describe('cardinalCrossings', () => {
  const at = (
    minutes: number,
    azimuth: number,
    altitude: number,
  ): TrajectoryPoint => ({
    time: new Date(2026, 9, 15, 12, minutes),
    azimuth,
    altitude,
  })

  it('marks each cardinal point the object sweeps through, in time order', () => {
    // A rising object swinging east → south-east → south while it is up.
    // Only the four cardinals are marked, so SE is skipped.
    const crossings = cardinalCrossings([
      at(0, 80, 5),
      at(10, 100, 20),
      at(20, 140, 30),
      at(30, 190, 25),
    ])

    expect(crossings.map((c) => c.label)).toEqual(['E', 'S'])
    for (let i = 1; i < crossings.length; i++) {
      expect(crossings[i].time.getTime()).toBeGreaterThan(
        crossings[i - 1].time.getTime(),
      )
    }
  })

  it('takes the short way round north rather than lapping the sky', () => {
    const crossings = cardinalCrossings([
      at(0, 350, 10),
      at(10, 10, 12),
    ])

    expect(crossings.map((c) => c.label)).toEqual(['N'])
  })

  it('ignores crossings that happen below the horizon', () => {
    const crossings = cardinalCrossings([
      at(0, 80, -5),
      at(10, 100, -2),
    ])

    expect(crossings).toEqual([])
  })
})

describe('everVisible', () => {
  it('is true for an object that clears a flat horizon', () => {
    expect(
      everVisible(
        altitudeChartModel({ object: M13, location: KYIV, date: DATE }),
      ),
    ).toBe(true)
  })

  it('is false when the horizon blocks the object all night', () => {
    // Polaris sits at ~50° altitude due north from Kyiv and barely moves; a
    // wall 80° high all around hides it for the whole window.
    const wall = new Horizon([
      { azimuth: 0, altitude: 80 },
      { azimuth: 180, altitude: 80 },
    ])
    const model = altitudeChartModel({
      object: POLARIS,
      location: KYIV,
      date: DATE,
      horizon: wall,
    })

    expect(model.peak!.altitude).toBeGreaterThan(45)
    expect(everVisible(model)).toBe(false)
  })

  it('is false for an object that never rises', () => {
    // Deep southern declination, seen from Kyiv.
    const southern: SkyObject = {
      id: 'test-southern',
      name: 'Southern test object',
      kind: 'deep-sky',
      ra: 6,
      dec: -80,
    }
    const model = altitudeChartModel({
      object: southern,
      location: KYIV,
      date: DATE,
    })

    expect(model.peak!.altitude).toBeLessThan(0)
    expect(everVisible(model)).toBe(false)
  })
})
