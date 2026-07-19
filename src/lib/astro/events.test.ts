import { describe, expect, it } from 'vitest'
import { computeObjectEvents } from './events'
import { horizontalAt } from './ephemeris'
import { nightWindow } from './time'
import { sampleTrajectory } from './trajectory'
import { Horizon } from '../horizon'
import type { DeepSkyObject, GeoLocation } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const CAPE_TOWN: GeoLocation = { latitude: -33.92, longitude: 18.42 }

const DATE = new Date(2026, 9, 15)
const MINUTE = 60_000

/** M13 — rises and sets from Kyiv, dipping only ~3° below the horizon. */
const M13: DeepSkyObject = {
  id: 'm13',
  name: 'Hercules Cluster',
  kind: 'deep-sky',
  ra: 16.6949,
  dec: 36.4613,
}

/** Circumpolar from anywhere in the northern mid-latitudes. */
const POLARIS: DeepSkyObject = {
  id: 'polaris',
  name: 'Polaris',
  kind: 'deep-sky',
  ra: 2.5303,
  dec: 89.264,
}

/** Far enough south never to clear the horizon from Kyiv. */
const LMC: DeepSkyObject = {
  id: 'lmc',
  name: 'Large Magellanic Cloud',
  kind: 'deep-sky',
  ra: 5.3923,
  dec: -69.7561,
}

/** A 40°-high wall over the north-east, where M13 rises. Clear elsewhere. */
const NORTHEAST_WALL = new Horizon([
  { azimuth: 0, altitude: 40 },
  { azimuth: 60, altitude: 40 },
  { azimuth: 61, altitude: 0 },
  { azimuth: 359, altitude: 0 },
])

/** A tree line of even height all the way round. */
const RIDGE = new Horizon([
  { azimuth: 0, altitude: 20 },
  { azimuth: 180, altitude: 20 },
])

const events = (
  object: DeepSkyObject,
  location: GeoLocation,
  horizon?: Horizon,
) =>
  computeObjectEvents({
    object,
    location,
    window: nightWindow(DATE),
    horizon,
  })

describe('computeObjectEvents — mathematical horizon', () => {
  it('reports a rise and a set for an object that does both', () => {
    const { rise, set, neverRises, circumpolar } = events(M13, KYIV)

    expect(rise).not.toBeNull()
    expect(set).not.toBeNull()
    expect(neverRises).toBe(false)
    expect(circumpolar).toBe(false)
  })

  it('puts rise and set at altitude 0 and reports where to look', () => {
    const { rise, set } = events(M13, KYIV)

    expect(rise!.altitude).toBeCloseTo(0, 1)
    expect(set!.altitude).toBeCloseTo(0, 1)
    // From the northern hemisphere a high-declination object rises in the
    // north-east and sets in the north-west.
    expect(rise!.azimuth).toBeGreaterThan(0)
    expect(rise!.azimuth).toBeLessThan(90)
    expect(set!.azimuth).toBeGreaterThan(270)
  })

  it('keeps every event inside the window', () => {
    const { window, rise, set, transit } = events(M13, KYIV)

    for (const point of [rise, set, transit]) {
      expect(point!.time.getTime()).toBeGreaterThanOrEqual(
        window.start.getTime(),
      )
      expect(point!.time.getTime()).toBeLessThanOrEqual(window.end.getTime())
    }
  })

  it('calls a circumpolar object neither risen nor never-rising', () => {
    const { rise, set, circumpolar, neverRises } = events(POLARIS, KYIV)

    expect(rise).toBeNull()
    expect(set).toBeNull()
    expect(circumpolar).toBe(true)
    expect(neverRises).toBe(false)
  })

  it('reports an object below the horizon all night as never rising', () => {
    const { circumpolar, neverRises, everClears, spans } = events(LMC, KYIV)

    expect(neverRises).toBe(true)
    expect(circumpolar).toBe(false)
    expect(everClears).toBe(false)
    expect(spans).toHaveLength(0)
  })

  it('has the same object rise and set from the southern hemisphere', () => {
    // The LMC is circumpolar from Cape Town — the mirror of the Kyiv case,
    // which pins that the midnight-altitude test is not hard-coded to a sign.
    const { circumpolar, neverRises } = events(LMC, CAPE_TOWN)

    expect(circumpolar).toBe(true)
    expect(neverRises).toBe(false)
  })
})

describe('computeObjectEvents — transit', () => {
  it('culminates on the meridian at the sampled peak altitude', () => {
    const { transit } = events(M13, KYIV)
    const peak = sampleTrajectory(M13, KYIV, nightWindow(DATE), 1)
      .points.map((p) => p.altitude)
      .reduce((a, b) => Math.max(a, b))

    // Due south from a latitude north of the object's declination.
    expect(transit!.azimuth).toBeCloseTo(180, 0)
    // 90 − |latitude − declination|, the standard culmination altitude.
    expect(transit!.altitude).toBeCloseTo(
      90 - Math.abs(KYIV.latitude - M13.dec),
      0,
    )
    // Solved, not sampled — but it must agree with the finest sampling.
    expect(transit!.altitude).toBeGreaterThanOrEqual(peak - 0.01)
  })

  it('beats a coarse sample of the trajectory, which rounds the peak off', () => {
    const { transit } = events(M13, KYIV)
    const coarse = sampleTrajectory(M13, KYIV, nightWindow(DATE), 30).points

    // Strictly higher: a transit read off the samples would tie with the best
    // of them, which is exactly the failure this is here to catch.
    const best = coarse.reduce((a, b) => (b.altitude > a.altitude ? b : a))
    expect(transit!.altitude).toBeGreaterThan(best.altitude)
    expect(transit!.time.getTime() % (30 * MINUTE)).not.toBe(
      coarse[0].time.getTime() % (30 * MINUTE),
    )
  })

  it('still finds the culmination of an object that never rises', () => {
    // Below the horizon the whole night, but it does cross the meridian, and
    // the depth of that crossing is how far short of visible it falls.
    const { transit } = events(LMC, KYIV)

    expect(transit).not.toBeNull()
    expect(transit!.altitude).toBeLessThan(0)
  })
})

describe('computeObjectEvents — observer horizon', () => {
  it('falls back to a flat horizon, agreeing with rise and set', () => {
    const { rise, set, clears, hides } = events(M13, KYIV)

    // Two independent methods — astronomy-engine's search and our own scan —
    // on the same threshold. Agreement to well under a minute is the check
    // that the scan is sound before it is trusted on a measured horizon.
    expect(
      Math.abs(clears!.time.getTime() - rise!.time.getTime()),
    ).toBeLessThan(MINUTE)
    expect(Math.abs(hides!.time.getTime() - set!.time.getTime())).toBeLessThan(
      MINUTE,
    )
  })

  it('delays the rise and advances the set behind an obstruction', () => {
    const flat = events(M13, KYIV)
    const blocked = events(M13, KYIV, RIDGE)

    expect(blocked.clears!.time.getTime()).toBeGreaterThan(
      flat.clears!.time.getTime(),
    )
    expect(blocked.hides!.time.getTime()).toBeLessThan(
      flat.hides!.time.getTime(),
    )
  })

  it('only delays the rise when the obstruction is where the object rises', () => {
    // M13 rises in the north-east and sets in the north-west, so a wall over
    // the north-east must move the one and leave the other alone. This is the
    // test that the profile is read at the object's *current* azimuth rather
    // than at some fixed direction.
    const flat = events(M13, KYIV)
    const blocked = events(M13, KYIV, NORTHEAST_WALL)

    expect(blocked.clears!.time.getTime()).toBeGreaterThan(
      flat.clears!.time.getTime(),
    )
    expect(blocked.hides!.time.getTime()).toBe(flat.hides!.time.getTime())
  })

  it('reports crossings exactly on the horizon profile', () => {
    const { spans } = events(M13, KYIV, NORTHEAST_WALL)

    for (const span of spans) {
      for (const [point, open] of [
        [span.start, span.openStart],
        [span.end, span.openEnd],
      ] as const) {
        if (open) continue
        expect(point.altitude).toBeCloseTo(
          NORTHEAST_WALL.altitudeAt(point.azimuth),
          1,
        )
      }
    }
  })

  it('marks a span that was already open when the window began', () => {
    const { spans } = events(POLARIS, KYIV, NORTHEAST_WALL)

    // Polaris sits at 50° in the north all night — above the wall, which does
    // not reach north, and never rising or setting.
    expect(spans).toHaveLength(1)
    expect(spans[0].openStart).toBe(true)
    expect(spans[0].openEnd).toBe(true)
  })

  it('agrees with the horizon at every sampled point of a span', () => {
    const { spans } = events(M13, KYIV, NORTHEAST_WALL)
    expect(spans.length).toBeGreaterThan(0)

    for (const span of spans) {
      const midMs = (span.start.time.getTime() + span.end.time.getTime()) / 2
      const middle = horizontalAt(M13, new Date(midMs), KYIV)
      expect(NORTHEAST_WALL.isVisible(middle.azimuth, middle.altitude)).toBe(
        true,
      )
    }
  })

  it('orders spans and keeps them disjoint', () => {
    const { spans } = events(M13, KYIV, NORTHEAST_WALL)

    for (let i = 0; i < spans.length; i++) {
      expect(spans[i].end.time.getTime()).toBeGreaterThan(
        spans[i].start.time.getTime(),
      )
      if (i > 0) {
        expect(spans[i].start.time.getTime()).toBeGreaterThan(
          spans[i - 1].end.time.getTime(),
        )
      }
    }
  })

  it('takes the first rise and the last set when there are several spans', () => {
    const { spans, clears, hides } = events(M13, KYIV, NORTHEAST_WALL)
    const rising = spans.filter((s) => !s.openStart)
    const setting = spans.filter((s) => !s.openEnd)

    expect(clears).toBe(rising[0]?.start ?? null)
    expect(hides).toBe(setting[setting.length - 1]?.end ?? null)
  })

  it('finds nothing above a horizon that blocks the whole sky', () => {
    const wall = new Horizon([{ azimuth: 0, altitude: 89 }])
    const { spans, clears, hides, everClears } = events(M13, KYIV, wall)

    expect(spans).toHaveLength(0)
    expect(clears).toBeNull()
    expect(hides).toBeNull()
    expect(everClears).toBe(false)
    // The object still rises above the *mathematical* horizon — the two
    // questions are genuinely different, which is why both are reported.
    expect(events(M13, KYIV, wall).rise).not.toBeNull()
  })
})
