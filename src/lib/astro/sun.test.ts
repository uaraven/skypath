import { describe, expect, it } from 'vitest'
import { computeSunEvents, sunAltitude, TWILIGHT_ALTITUDES } from './sun'
import type { GeoLocation } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const EQUATOR: GeoLocation = { latitude: 0, longitude: 0 }
const LONGYEARBYEN: GeoLocation = { latitude: 78.22, longitude: 15.65 }
const MCMURDO: GeoLocation = { latitude: -77.85, longitude: 166.67 }

const MINUTES = 60_000

describe('computeSunEvents', () => {
  it('orders dusk, night and dawn correctly through the night', () => {
    const events = computeSunEvents(new Date(2026, 9, 15), KYIV)

    const sequence = [
      events.sunset,
      events.twilight.civil.dusk,
      events.twilight.nautical.dusk,
      events.twilight.astronomical.dusk,
      events.twilight.astronomical.dawn,
      events.twilight.nautical.dawn,
      events.twilight.civil.dawn,
      events.sunrise,
    ]

    expect(sequence.every((t) => t !== null)).toBe(true)
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]!.getTime()).toBeGreaterThan(sequence[i - 1]!.getTime())
    }
  })

  it('places every event inside the noon-to-noon window', () => {
    const events = computeSunEvents(new Date(2026, 9, 15), KYIV)
    const all = [
      events.sunset,
      events.sunrise,
      ...Object.values(events.twilight).flatMap((p) => [p.dusk, p.dawn]),
    ]

    for (const time of all) {
      expect(time!.getTime()).toBeGreaterThanOrEqual(
        events.window.start.getTime(),
      )
      expect(time!.getTime()).toBeLessThanOrEqual(events.window.end.getTime())
    }
  })

  it('finds the sun at the expected depression angle at each twilight time', () => {
    const events = computeSunEvents(new Date(2026, 9, 15), KYIV)

    for (const [phase, altitude] of Object.entries(TWILIGHT_ALTITUDES)) {
      const pair = events.twilight[phase as keyof typeof TWILIGHT_ALTITUDES]

      expect(sunAltitude(pair.dusk!, KYIV)).toBeCloseTo(altitude, 3)
      expect(sunAltitude(pair.dawn!, KYIV)).toBeCloseTo(altitude, 3)
    }
  })

  /**
   * Twilight is defined geometrically but the charts draw apparent altitude.
   * Refraction lifts the sun by roughly half a degree near the horizon, so the
   * two conventions must not be used interchangeably.
   */
  it('separates geometric and apparent altitude near the horizon', () => {
    const events = computeSunEvents(new Date(2026, 9, 15), KYIV)
    const dusk = events.twilight.civil.dusk!

    const geometric = sunAltitude(dusk, KYIV, 'geometric')
    const apparent = sunAltitude(dusk, KYIV, 'apparent')

    expect(geometric).toBeCloseTo(-6, 3)
    expect(apparent).toBeGreaterThan(geometric)
    expect(apparent - geometric).toBeLessThan(1)
  })

  it('gives a roughly 12-hour day at the equator on the equinox', () => {
    const events = computeSunEvents(new Date(2026, 2, 20), EQUATOR)
    const dayLength = events.sunrise!.getTime() - events.sunset!.getTime()

    // sunset that evening to sunrise the next morning is the *night*, which is
    // 12 hours minus the extra few minutes refraction adds to the day.
    expect(dayLength / MINUTES).toBeGreaterThan(11 * 60)
    expect(dayLength / MINUTES).toBeLessThan(12 * 60)
  })

  describe('polar cases', () => {
    it('reports polar day in the arctic midsummer', () => {
      const events = computeSunEvents(new Date(2026, 5, 21), LONGYEARBYEN)

      expect(events.sunset).toBeNull()
      expect(events.sunrise).toBeNull()
      expect(events.polarDay).toBe(true)
      expect(events.polarNight).toBe(false)
      expect(sunAltitude(events.window.midnight, LONGYEARBYEN)).toBeGreaterThan(
        0,
      )
    })

    it('reports polar night in the arctic midwinter', () => {
      const events = computeSunEvents(new Date(2026, 11, 21), LONGYEARBYEN)

      expect(events.sunset).toBeNull()
      expect(events.sunrise).toBeNull()
      expect(events.polarNight).toBe(true)
      expect(events.polarDay).toBe(false)
    })

    it('mirrors the seasons in the antarctic', () => {
      expect(computeSunEvents(new Date(2026, 11, 21), MCMURDO).polarDay).toBe(
        true,
      )
      expect(computeSunEvents(new Date(2026, 5, 21), MCMURDO).polarNight).toBe(
        true,
      )
    })

    it('reports no astronomical night at a latitude that never gets one', () => {
      // Midsummer at Kyiv: the sun stays above −18°, so there is no
      // astronomical twilight boundary to cross.
      const events = computeSunEvents(new Date(2026, 5, 21), KYIV)

      expect(events.twilight.astronomical.dusk).toBeNull()
      expect(events.twilight.astronomical.dawn).toBeNull()
      // but the sun still rises and sets normally
      expect(events.sunset).not.toBeNull()
      expect(events.sunrise).not.toBeNull()
    })
  })
})
