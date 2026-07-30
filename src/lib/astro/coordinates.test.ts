import { Body } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import {
  equatorialPosition,
  formatCoordinatesForClipboard,
  formatDec,
  formatRa,
} from './coordinates'
import type { DeepSkyObject, GeoLocation, SkyObject } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }

const M13: DeepSkyObject = {
  id: 'M13',
  name: 'M13',
  kind: 'deep-sky',
  ra: 16.69479,
  dec: 36.45986,
}

const MOON: SkyObject = {
  id: 'moon',
  name: 'Moon',
  kind: 'moon',
  body: Body.Moon,
}

describe('equatorialPosition', () => {
  it('reports a catalogue object at its fixed J2000 coordinates', () => {
    const time = new Date(Date.UTC(2026, 6, 18, 22))
    expect(equatorialPosition(M13, time, KYIV)).toEqual({
      ra: M13.ra,
      dec: M13.dec,
    })
  })

  it('reports different of-date coordinates for a solar-system body over time', () => {
    const a = equatorialPosition(MOON, new Date(Date.UTC(2026, 0, 1)), KYIV)
    const b = equatorialPosition(MOON, new Date(Date.UTC(2026, 6, 18)), KYIV)
    expect(a.ra).not.toBeCloseTo(b.ra, 0)
  })
})

describe('formatRa', () => {
  it('formats whole hours', () => {
    expect(formatRa(5.5)).toBe('05h 30m 00s')
  })

  it('wraps negative and out-of-range values into 0-24h', () => {
    expect(formatRa(-1)).toBe('23h 00m 00s')
    expect(formatRa(25)).toBe('01h 00m 00s')
  })

  it('carries seconds that round up to the next minute', () => {
    // 59.9999 minutes worth of seconds should round up to 0m 0s of the next hour.
    expect(formatRa(0.99999722)).toBe('01h 00m 00s')
  })
})

describe('formatDec', () => {
  it('formats a positive declination', () => {
    expect(formatDec(22.25)).toBe('+22° 15′ 00″')
  })

  it('formats a negative declination', () => {
    expect(formatDec(-22.25)).toBe('-22° 15′ 00″')
  })

  it('formats zero with a plus sign', () => {
    expect(formatDec(0)).toBe('+00° 00′ 00″')
  })
})

describe('formatCoordinatesForClipboard', () => {
  it('formats RA to three decimal seconds and dec to two, space-separated', () => {
    const ra = 20 + 54 / 60 + 5.689 / 3600
    const dec = 37 + 1 / 60 + 17.38 / 3600
    expect(formatCoordinatesForClipboard({ ra, dec })).toBe(
      '20 54 05.689 +37 01 17.38',
    )
  })

  it('signs a negative declination', () => {
    expect(formatCoordinatesForClipboard({ ra: 0, dec: -11.62306 })).toBe(
      '00 00 00.000 -11 37 23.02',
    )
  })

  it('wraps RA seconds rounding up past 24h back to 00', () => {
    // Within 0.0002ms of 24h — well inside the 0.5ms window that rounds up
    // to the next whole millisecond of time (0.001s), which is 24:00:00.000.
    expect(formatCoordinatesForClipboard({ ra: 24 - 2e-11, dec: 0 })).toBe(
      '00 00 00.000 +00 00 00.00',
    )
  })
})
