import { Body, Equator, Horizon, SearchHourAngle } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { horizontalAt, toObserver, withEngineBody } from './ephemeris'
import type { DeepSkyObject, GeoLocation, SkyObject } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const EQUATOR: GeoLocation = { latitude: 0, longitude: 0 }
const CAPE_TOWN: GeoLocation = { latitude: -33.92, longitude: 18.42 }

/** J2000 coordinates; RA in hours, dec in degrees. */
const dso = (id: string, ra: number, dec: number): DeepSkyObject => ({
  id,
  name: id,
  kind: 'deep-sky',
  ra,
  dec,
})

const POLARIS = dso('Polaris', 2.5303, 89.26411)
const M13 = dso('M13', 16.69479, 36.45986)
const M104 = dso('M104', 12.6665, -11.62306)

const SUN: SkyObject = { id: 'sun', name: 'Sun', kind: 'sun', body: Body.Sun }

describe('horizontalAt', () => {
  /**
   * Polaris sits ~0.74° off the celestial pole, so it circles the pole once a
   * day. Averaged over a full day its altitude collapses to the observer's
   * latitude — a check that depends on no catalogue value but Polaris's own.
   */
  it('puts Polaris at the observer latitude when averaged over a day', () => {
    for (const location of [KYIV, { latitude: 20, longitude: 0 }]) {
      const altitudes = []
      for (let hour = 0; hour < 24; hour++) {
        const time = new Date(Date.UTC(2026, 6, 18, hour))
        altitudes.push(horizontalAt(POLARIS, time, location).altitude)
      }
      const mean = altitudes.reduce((a, b) => a + b, 0) / altitudes.length

      expect(mean).toBeCloseTo(location.latitude, 1)
    }
  })

  /**
   * Pure spherical geometry: at upper culmination an object's altitude is
   * 90° − |latitude − declination|. The declination comes from the library,
   * the identity does not.
   */
  it('matches the culmination altitude identity', () => {
    const cases: Array<[SkyObject, GeoLocation]> = [
      [M13, KYIV],
      [M104, CAPE_TOWN],
      [SUN, KYIV],
      [SUN, EQUATOR],
    ]

    for (const [object, location] of cases) {
      const observer = toObserver(location)
      const start = new Date(Date.UTC(2026, 6, 18))

      // Re-derive the transit through the library's own search path.
      const { expected, actual } = withEngineBody(object, (body) => {
        const transit = SearchHourAngle(body, observer, 0, start)
        const dec = Equator(body, transit.time, observer, true, true).dec
        return {
          expected: 90 - Math.abs(location.latitude - dec),
          actual: horizontalAt(object, transit.time.date, location).altitude,
        }
      })

      expect(actual).toBeCloseTo(expected, 1)
    }
  })

  /**
   * Catalogue coordinates are J2000 and must be precessed to the date. Skipping
   * that step is a silent ~0.3° error, so pin the difference explicitly.
   */
  it('precesses J2000 coordinates rather than using them raw', () => {
    const time = new Date(Date.UTC(2026, 6, 18, 22))
    const observer = toObserver(KYIV)

    const precessed = horizontalAt(M13, time, KYIV)
    const raw = Horizon(time, observer, M13.ra, M13.dec, 'normal')

    const separation = Math.hypot(
      precessed.altitude - raw.altitude,
      (precessed.azimuth - raw.azimuth) *
        Math.cos((precessed.altitude * Math.PI) / 180),
    )
    expect(separation).toBeGreaterThan(0.1)
    expect(separation).toBeLessThan(1)
  })

  it('returns azimuth in [0, 360) and altitude in [-90, 90]', () => {
    for (let hour = 0; hour < 24; hour++) {
      const { altitude, azimuth } = horizontalAt(
        M13,
        new Date(Date.UTC(2026, 6, 18, hour)),
        KYIV,
      )

      expect(azimuth).toBeGreaterThanOrEqual(0)
      expect(azimuth).toBeLessThan(360)
      expect(altitude).toBeGreaterThanOrEqual(-90)
      expect(altitude).toBeLessThanOrEqual(90)
    }
  })

  /**
   * Catalogue objects share one overwritable star slot inside
   * astronomy-engine, so interleaving two of them must not blend their
   * coordinates.
   */
  it('keeps interleaved catalogue objects independent', () => {
    const time = new Date(Date.UTC(2026, 6, 18, 22))

    const m13Alone = horizontalAt(M13, time, KYIV)
    horizontalAt(M104, time, KYIV)
    const m13AfterOther = horizontalAt(M13, time, KYIV)

    expect(m13AfterOther).toEqual(m13Alone)
  })

  it('reports objects below the horizon as negative altitude', () => {
    // At lower culmination M104 is far below Kyiv's horizon.
    const observer = toObserver(KYIV)
    const lower = withEngineBody(M104, (body) =>
      SearchHourAngle(body, observer, 12, new Date(Date.UTC(2026, 6, 18))),
    )

    expect(horizontalAt(M104, lower.time.date, KYIV).altitude).toBeLessThan(0)
  })
})

describe('withEngineBody', () => {
  it('passes through the engine body for solar-system objects', () => {
    expect(withEngineBody(SUN, (body) => body)).toBe(Body.Sun)
  })

  it('installs catalogue objects into a star slot', () => {
    const observer = toObserver(KYIV)
    const time = new Date(Date.UTC(2026, 6, 18, 22))

    const eq = withEngineBody(M13, (body) =>
      Equator(body, time, observer, true, true),
    )

    // Precession shifts J2000 slightly, so compare loosely.
    expect(eq.ra).toBeCloseTo(M13.ra, 1)
    expect(eq.dec).toBeCloseTo(M13.dec, 1)
  })
})
