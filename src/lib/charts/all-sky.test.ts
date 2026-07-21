import { describe, expect, it } from 'vitest'
import type { GeoLocation, SkyObject, TrajectoryPoint } from '../astro/types'
import { objectByDesignation } from '../catalog'
import { Horizon, horizonFromText } from '../horizon'
import carrHorizon from '../horizon/fixtures/e.c.carr-horizon.txt?raw'
import { aboveHorizonArcs, allSkyChartModel } from './all-sky'

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
/** Never rises from Kyiv. */
const SOUTHERN: SkyObject = {
  id: 'test-southern',
  name: 'Southern test object',
  kind: 'deep-sky',
  ra: 6,
  dec: -80,
}

function point(
  altitude: number,
  azimuth: number,
  minute: number,
): TrajectoryPoint {
  return { time: new Date(2026, 9, 15, 12, minute), altitude, azimuth }
}

describe('aboveHorizonArcs', () => {
  it('keeps a wholly-visible track as one arc', () => {
    const points = [point(10, 90, 0), point(20, 100, 5), point(30, 110, 10)]
    expect(aboveHorizonArcs(points)).toEqual([points])
  })

  it('drops a track that never rises', () => {
    const points = [point(-10, 90, 0), point(-5, 100, 5)]
    expect(aboveHorizonArcs(points)).toEqual([])
  })

  it('splits into one arc per pass above the horizon', () => {
    const points = [
      point(-5, 0, 0),
      point(5, 10, 5),
      point(-5, 20, 10),
      point(5, 30, 15),
    ]
    expect(aboveHorizonArcs(points)).toHaveLength(2)
  })

  it('starts and ends each arc exactly on the rim', () => {
    // A dial has no room below the rim, so an arc that simply began at the
    // first above-horizon *sample* would visibly start short of the edge.
    const arcs = aboveHorizonArcs([
      point(-10, 90, 0),
      point(10, 100, 10),
      point(-10, 110, 20),
    ])

    const [arc] = arcs
    expect(arc[0].altitude).toBe(0)
    expect(arc[arc.length - 1].altitude).toBe(0)
    // Halfway between the samples in both time and azimuth.
    expect(arc[0].azimuth).toBeCloseTo(95, 6)
    expect(arc[0].time.getMinutes()).toBe(5)
    expect(arc[arc.length - 1].azimuth).toBeCloseTo(105, 6)
  })

  it('takes the short way round when the crossing passes north', () => {
    // Straight interpolation from 355° to 5° would sweep backwards through the
    // entire sky and put the rim crossing due south.
    const [arc] = aboveHorizonArcs([point(-10, 355, 0), point(10, 5, 10)])
    expect(arc[0].azimuth).toBeCloseTo(0, 6)
  })

  it('does not interpolate a crossing at the very first sample', () => {
    // There is no earlier sample to interpolate from: the arc has to begin at
    // the sample itself, wherever on the dial that is.
    const points = [point(40, 180, 0), point(30, 190, 5)]
    const [arc] = aboveHorizonArcs(points)
    expect(arc[0]).toBe(points[0])
  })
})

describe('allSkyChartModel', () => {
  it('draws M13 as two arcs — it sets and rises again inside the window', () => {
    const model = allSkyChartModel({ object: M13, location: KYIV, date: DATE })

    // The window is local noon to noon, and in mid-October M13 is already up
    // at noon: it culminates early in the afternoon, sets in the evening, and
    // is back up before the window closes. Two passes, not one.
    expect(model.arcs).toHaveLength(2)
    expect(model.arcs[0][0].time).toEqual(model.window.start)
    expect(model.arcs[1][model.arcs[1].length - 1].time).toEqual(
      model.window.end,
    )
    expect(model.peak!.altitude).toBeCloseTo(76, 0)
    expect(Math.abs(model.peak!.azimuth - 180)).toBeLessThan(1)
    expect(model.everClears).toBe(true)
  })

  it('leaves the Moon out unless asked, and includes it when asked', () => {
    const without = allSkyChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
    })
    expect(without.moon).toBeNull()

    const withMoon = allSkyChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
      includeMoon: true,
    })
    expect(withMoon.moon).not.toBeNull()
    expect(withMoon.moon!.illumination).toBeGreaterThanOrEqual(0)
    expect(withMoon.moon!.illumination).toBeLessThanOrEqual(1)
    // Every point of every Moon arc is at or above the rim, like the object's.
    for (const arc of withMoon.moon!.arcs) {
      for (const p of arc) expect(p.altitude).toBeGreaterThanOrEqual(0)
    }
  })

  it('leaves no arcs for an object that never rises', () => {
    const model = allSkyChartModel({
      object: SOUTHERN,
      location: KYIV,
      date: DATE,
    })

    expect(model.arcs).toEqual([])
    expect(model.hourMarks).toEqual([])
    expect(model.everClears).toBe(false)
  })

  it('keeps a circumpolar object above the horizon for the whole window', () => {
    const model = allSkyChartModel({
      object: POLARIS,
      location: KYIV,
      date: DATE,
    })

    expect(model.arcs).toHaveLength(1)
    // No rim crossings, so the arc is exactly the sampled track.
    expect(model.arcs[0].every((p) => p.altitude > 0)).toBe(true)
    expect(model.hourMarks).toHaveLength(25)
  })

  it('marks whole hours, labelling every third one', () => {
    const model = allSkyChartModel({
      object: POLARIS,
      location: KYIV,
      date: DATE,
    })

    expect(model.hourMarks.every((m) => m.time.getMinutes() === 0)).toBe(true)
    expect(model.hourMarks.filter((m) => m.labelled)).toHaveLength(9)
    expect(
      model.hourMarks.every(
        (m) => m.labelled === (m.time.getHours() % 3 === 0),
      ),
    ).toBe(true)
  })

  it('marks hours independently of the trajectory sampling step', () => {
    // The step need not divide an hour, so the marks cannot be filtered out of
    // the track — they are computed from the ephemeris directly.
    const coarse = allSkyChartModel({
      object: POLARIS,
      location: KYIV,
      date: DATE,
      stepMinutes: 7,
    })

    expect(coarse.hourMarks).toHaveLength(25)
  })

  it('samples the horizon all the way round from north', () => {
    const horizon = horizonFromText(carrHorizon)
    const model = allSkyChartModel({
      object: M13,
      location: KYIV,
      date: DATE,
      horizon,
    })

    expect(model.horizonProfile).toHaveLength(360)
    expect(model.horizonProfile[0].azimuth).toBe(0)
    expect(model.horizonProfile[359].azimuth).toBe(359)
    for (const sample of model.horizonProfile) {
      expect(sample.altitude).toBeCloseTo(
        horizon.altitudeAt(sample.azimuth),
        10,
      )
    }
    // Due north falls in the file's 335°→5° wrap segment, well above zero.
    expect(model.horizonProfile[0].altitude).toBeGreaterThan(50)
  })

  it('is flat at zero when the observatory has no horizon file', () => {
    const model = allSkyChartModel({ object: M13, location: KYIV, date: DATE })
    expect(model.horizonProfile.every((s) => s.altitude === 0)).toBe(true)
  })

  it('still draws the track of an object its horizon never clears', () => {
    // The arcs are cut at the *mathematical* horizon, not the observer's: a
    // blocked object is drawn dimmed under the obstruction, not omitted.
    const wall = new Horizon([
      { azimuth: 0, altitude: 80 },
      { azimuth: 180, altitude: 80 },
    ])
    const model = allSkyChartModel({
      object: POLARIS,
      location: KYIV,
      date: DATE,
      horizon: wall,
    })

    expect(model.everClears).toBe(false)
    expect(model.arcs).toHaveLength(1)
  })
})
