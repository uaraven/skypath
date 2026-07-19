import { describe, expect, it } from 'vitest'
import { computeSunEvents, sunAltitude } from '../astro/sun'
import { nightWindow } from '../astro/time'
import type { GeoLocation } from '../astro/types'
import { PHASE_FLOOR, phaseAt, skyBands, type SkyBand } from './sky-bands'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const LONGYEARBYEN: GeoLocation = { latitude: 78.22, longitude: 15.65 }
const MCMURDO: GeoLocation = { latitude: -77.85, longitude: 166.67 }
const QUITO: GeoLocation = { latitude: -0.18, longitude: -78.47 }
const NORTH_POLE: GeoLocation = { latitude: 89.9, longitude: 0 }

/** Boundaries are bisected to the second, so allow a couple either way. */
const TOLERANCE_MS = 2000

function expectSameInstant(actual: Date, expected: Date) {
  expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThanOrEqual(
    TOLERANCE_MS,
  )
}

describe('phaseAt', () => {
  it('classifies each twilight range by the sun altitude', () => {
    expect(phaseAt(20)).toBe('day')
    expect(phaseAt(0)).toBe('day')
    expect(phaseAt(-3)).toBe('civil')
    expect(phaseAt(-9)).toBe('nautical')
    expect(phaseAt(-15)).toBe('astronomical')
    expect(phaseAt(-30)).toBe('night')
  })

  it('puts each floor altitude in its own phase, not the next one down', () => {
    expect(phaseAt(PHASE_FLOOR.day)).toBe('day')
    expect(phaseAt(PHASE_FLOOR.civil)).toBe('civil')
    expect(phaseAt(PHASE_FLOOR.nautical)).toBe('nautical')
    expect(phaseAt(PHASE_FLOOR.astronomical)).toBe('astronomical')
  })
})

describe('skyBands', () => {
  it('tiles the whole window with no gaps or overlaps', () => {
    const window = nightWindow(new Date(2026, 9, 15))
    const bands = skyBands(window, KYIV)

    expect(bands[0].start).toEqual(window.start)
    expect(bands[bands.length - 1].end).toEqual(window.end)
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].start).toEqual(bands[i - 1].end)
    }
  })

  it('never emits two adjacent bands of the same phase', () => {
    const bands = skyBands(nightWindow(new Date(2026, 9, 15)), KYIV)
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].phase).not.toBe(bands[i - 1].phase)
    }
  })

  it('runs day → twilights → night → twilights → day over a mid-latitude night', () => {
    const bands = skyBands(nightWindow(new Date(2026, 9, 15)), KYIV)

    expect(bands.map((b) => b.phase)).toEqual([
      'day',
      'civil',
      'nautical',
      'astronomical',
      'night',
      'astronomical',
      'nautical',
      'civil',
      'day',
    ])
  })

  it('places every band boundary at its defining sun altitude', () => {
    const bands = skyBands(nightWindow(new Date(2026, 9, 15)), KYIV)

    for (let i = 1; i < bands.length; i++) {
      const boundary = bands[i].start
      // Whichever of the two phases is lighter owns the threshold.
      const threshold = Math.max(
        PHASE_FLOOR[bands[i - 1].phase],
        PHASE_FLOOR[bands[i].phase],
      )
      expect(sunAltitude(boundary, KYIV)).toBeCloseTo(threshold, 2)
    }
  })

  it('agrees with computeSunEvents on sunset and the twilight times', () => {
    const date = new Date(2026, 9, 15)
    const events = computeSunEvents(date, KYIV)
    const bands = skyBands(nightWindow(date), KYIV)

    const startOf = (phase: SkyBand['phase']) =>
      bands.find((b) => b.phase === phase)!.start

    expectSameInstant(startOf('civil'), events.sunset!)
    expectSameInstant(startOf('nautical'), events.twilight.civil.dusk!)
    expectSameInstant(startOf('night'), events.twilight.astronomical.dusk!)
  })

  it('reports polar day as a single day band', () => {
    const bands = skyBands(nightWindow(new Date(2026, 5, 21)), LONGYEARBYEN)

    expect(bands).toHaveLength(1)
    expect(bands[0].phase).toBe('day')
  })

  it('reports polar night as a single night band', () => {
    // Only above ~84.6°N does the midwinter sun stay below −18° all day.
    const bands = skyBands(nightWindow(new Date(2026, 11, 21)), NORTH_POLE)

    expect(bands).toHaveLength(1)
    expect(bands[0].phase).toBe('night')
  })

  it('still finds midday twilight during a polar night that is not fully dark', () => {
    // Longyearbyen's midwinter sun peaks near −11°, so its "polar night" is
    // dark at midnight but brightens to nautical twilight around noon — never
    // reaching civil twilight, let alone day. The window opens an hour after
    // solar noon (15.65°E, tests pinned to UTC), so it starts on the descent
    // and closes on the far side of the next midday brightening.
    const bands = skyBands(nightWindow(new Date(2026, 11, 21)), LONGYEARBYEN)

    expect(bands.map((b) => b.phase)).toEqual([
      'astronomical',
      'night',
      'astronomical',
      'nautical',
      'astronomical',
    ])
  })

  it('handles the southern polar day too', () => {
    const bands = skyBands(nightWindow(new Date(2026, 11, 21)), MCMURDO)

    expect(bands).toHaveLength(1)
    expect(bands[0].phase).toBe('day')
  })

  it('resolves the fast equatorial twilight, where the sun drops quickest', () => {
    // Near the equator the sun crosses all three twilight boundaries in about
    // 70 minutes — the case a coarse sampler would smear or skip.
    const bands = skyBands(nightWindow(new Date(2026, 2, 20)), QUITO)

    expect(bands.map((b) => b.phase)).toEqual([
      'day',
      'civil',
      'nautical',
      'astronomical',
      'night',
      'astronomical',
      'nautical',
      'civil',
      'day',
    ])

    const civil = bands[1]
    const duration = civil.end.getTime() - civil.start.getTime()
    expect(duration / 60_000).toBeGreaterThan(15)
    expect(duration / 60_000).toBeLessThan(30)
  })

  it('is unchanged by a finer sampling step', () => {
    const window = nightWindow(new Date(2026, 9, 15))
    const coarse = skyBands(window, KYIV, 2)
    const fine = skyBands(window, KYIV, 0.5)

    expect(fine.map((b) => b.phase)).toEqual(coarse.map((b) => b.phase))
    for (let i = 0; i < fine.length; i++) {
      expectSameInstant(fine[i].start, coarse[i].start)
    }
  })
})
