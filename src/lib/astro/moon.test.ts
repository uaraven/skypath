import { Body, SearchAltitude, SearchMoonPhase } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { computeMoonEvents, moonPhaseName, MOON } from './moon'
import { horizontalAt, toObserver } from './ephemeris'
import { nightWindow } from './time'
import type { GeoLocation } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const LONGYEARBYEN: GeoLocation = { latitude: 78.22, longitude: 15.65 }

const MINUTE = 60_000

/** The night `phase` degrees of elongation falls in, as a local date. */
function nightOfPhase(target: number, after: Date): Date {
  const found = SearchMoonPhase(target, after, 40)!
  return new Date(found.date)
}

describe('moonPhaseName', () => {
  it('names each quarter at its defining angle', () => {
    expect(moonPhaseName(0)).toBe('New Moon')
    expect(moonPhaseName(90)).toBe('First Quarter')
    expect(moonPhaseName(180)).toBe('Full Moon')
    expect(moonPhaseName(270)).toBe('Last Quarter')
  })

  it('names the crescents and gibbous phases between them', () => {
    expect(moonPhaseName(45)).toBe('Waxing Crescent')
    expect(moonPhaseName(135)).toBe('Waxing Gibbous')
    expect(moonPhaseName(225)).toBe('Waning Gibbous')
    expect(moonPhaseName(315)).toBe('Waning Crescent')
  })

  it('centres each bin on its named instant rather than starting there', () => {
    // A moon 20° past full is still spoken of as full; 25° past is gibbous.
    expect(moonPhaseName(160)).toBe('Full Moon')
    expect(moonPhaseName(200)).toBe('Full Moon')
    expect(moonPhaseName(205)).toBe('Waning Gibbous')
  })

  it('wraps around the end of the cycle', () => {
    expect(moonPhaseName(350)).toBe('New Moon')
    expect(moonPhaseName(360)).toBe('New Moon')
    expect(moonPhaseName(10)).toBe('New Moon')
  })
})

describe('computeMoonEvents', () => {
  it('reports a rise and a set inside the window', () => {
    const window = nightWindow(new Date(2026, 9, 15))
    const { rise, set } = computeMoonEvents(window, KYIV)

    for (const point of [rise, set]) {
      expect(point).not.toBeNull()
      expect(point!.time.getTime()).toBeGreaterThanOrEqual(
        window.start.getTime(),
      )
      expect(point!.time.getTime()).toBeLessThanOrEqual(window.end.getTime())
    }
  })

  it('times moonrise by the upper limb, minutes before the centre rises', () => {
    const window = nightWindow(new Date(2026, 9, 15))
    const observer = toObserver(KYIV)
    const { rise } = computeMoonEvents(window, KYIV)

    // What a naive implementation would do: search for the moment the Moon's
    // centre reaches altitude 0. Moonrise is conventionally the upper limb
    // appearing, about a quarter of a degree earlier — a real difference of
    // several minutes, and the reason this does not go through the same
    // altitude scan the deep-sky objects use.
    const centreRise = SearchAltitude(
      Body.Moon,
      observer,
      1,
      window.start,
      1,
      0,
    )!

    const earlierBy = centreRise.date.getTime() - rise!.time.getTime()
    expect(earlierBy).toBeGreaterThan(MINUTE)
    expect(earlierBy).toBeLessThan(15 * MINUTE)

    // Still within a degree of the horizon — this is a correction, not a
    // different event.
    expect(
      Math.abs(horizontalAt(MOON, rise!.time, KYIV).altitude),
    ).toBeLessThan(1)
  })

  it('is nearly fully lit at full moon and dark at new moon', () => {
    const full = computeMoonEvents(
      nightWindow(nightOfPhase(180, new Date(2026, 0, 1))),
      KYIV,
    )
    const zero = computeMoonEvents(
      nightWindow(nightOfPhase(0, new Date(2026, 0, 1))),
      KYIV,
    )

    expect(full.illumination).toBeGreaterThan(0.97)
    expect(full.phaseName).toBe('Full Moon')
    expect(zero.illumination).toBeLessThan(0.05)
    expect(zero.phaseName).toBe('New Moon')
  })

  it('names a waxing and a waning half moon apart', () => {
    const first = computeMoonEvents(
      nightWindow(nightOfPhase(90, new Date(2026, 0, 1))),
      KYIV,
    )
    const last = computeMoonEvents(
      nightWindow(nightOfPhase(270, new Date(2026, 0, 1))),
      KYIV,
    )

    // Roughly half-lit either way: the quarter falls at some hour of the day
    // and the phase is read at the following local midnight, so the moon has
    // up to a day — about 12° of elongation — to drift off exactly half.
    for (const { illumination } of [first, last]) {
      expect(illumination).toBeGreaterThan(0.35)
      expect(illumination).toBeLessThan(0.65)
    }
    // Same half-lit disc, opposite halves of the cycle — the illuminated
    // fraction alone cannot tell them apart, which is why the phase angle is
    // what names the phase.
    expect(first.phaseName).toBe('First Quarter')
    expect(last.phaseName).toBe('Last Quarter')
  })

  it('delays moonrise by roughly 50 minutes from one night to the next', () => {
    const first = computeMoonEvents(nightWindow(new Date(2026, 9, 15)), KYIV)
    const second = computeMoonEvents(nightWindow(new Date(2026, 9, 16)), KYIV)

    const delay =
      second.rise!.time.getTime() -
      first.rise!.time.getTime() -
      24 * 60 * MINUTE
    expect(delay / MINUTE).toBeGreaterThan(20)
    expect(delay / MINUTE).toBeLessThan(90)
  })

  it('returns nulls where the moon does not cross the horizon at all', () => {
    // Far enough north that the Moon can stay up — or stay down — for a whole
    // window, exactly as an object can. Null is the answer, not a failure.
    const nights = Array.from({ length: 28 }, (_, i) =>
      nightWindow(new Date(2026, 0, 1 + i)),
    ).map((window) => computeMoonEvents(window, LONGYEARBYEN))

    expect(nights.some((n) => n.rise === null || n.set === null)).toBe(true)
  })
})
