import { describe, expect, it } from 'vitest'
import { FLAT_HORIZON, Horizon, normalizeAzimuth } from './horizon'
import { parseHorizon } from './parser'
import carrHorizon from './fixtures/e.c.carr-horizon.txt?raw'

const carr = new Horizon(parseHorizon(carrHorizon).points)

describe('Horizon.altitudeAt', () => {
  it('returns the measured value at a measured azimuth', () => {
    expect(carr.altitudeAt(5)).toBe(55)
    expect(carr.altitudeAt(120)).toBe(27)
    expect(carr.altitudeAt(335)).toBe(45)
  })

  it('interpolates linearly between two points', () => {
    // 5°→20° climbs 55°→61°, so the midpoint at 12.5° sits at 58°.
    expect(carr.altitudeAt(12.5)).toBeCloseTo(58, 10)
    // 99°→120° is flat at 27°.
    expect(carr.altitudeAt(110)).toBeCloseTo(27, 10)
  })

  it('wraps across north between the last and first points', () => {
    // The 335°(45°) → 5°(55°) segment spans 30° of azimuth through north.
    expect(carr.altitudeAt(350)).toBeCloseTo(50, 10)
    expect(carr.altitudeAt(0)).toBeCloseTo(53 + 1 / 3, 10)
    expect(carr.altitudeAt(359)).toBeCloseTo(53, 10)
  })

  it('is continuous across the 360°/0° seam', () => {
    const below = carr.altitudeAt(359.999)
    const above = carr.altitudeAt(0.001)

    expect(Math.abs(above - below)).toBeLessThan(0.01)
  })

  it('normalizes azimuths outside 0–360', () => {
    expect(carr.altitudeAt(365)).toBeCloseTo(carr.altitudeAt(5), 10)
    expect(carr.altitudeAt(-25)).toBeCloseTo(carr.altitudeAt(335), 10)
    expect(carr.altitudeAt(720 + 120)).toBeCloseTo(carr.altitudeAt(120), 10)
  })

  it('sorts unsorted input before interpolating', () => {
    const horizon = new Horizon([
      { azimuth: 270, altitude: 30 },
      { azimuth: 90, altitude: 10 },
    ])

    expect(horizon.points.map((p) => p.azimuth)).toEqual([90, 270])
    expect(horizon.altitudeAt(180)).toBeCloseTo(20, 10)
  })

  it('treats an empty horizon as flat at 0°', () => {
    expect(FLAT_HORIZON.isFlat).toBe(true)
    expect(FLAT_HORIZON.altitudeAt(0)).toBe(0)
    expect(FLAT_HORIZON.altitudeAt(217)).toBe(0)
  })

  it('treats a single point as a constant horizon all the way round', () => {
    const horizon = new Horizon([{ azimuth: 90, altitude: 12 }])

    expect(horizon.altitudeAt(90)).toBe(12)
    expect(horizon.altitudeAt(270)).toBe(12)
  })

  it('interpolates both ways round with only two points', () => {
    const horizon = new Horizon([
      { azimuth: 0, altitude: 0 },
      { azimuth: 180, altitude: 40 },
    ])

    expect(horizon.altitudeAt(90)).toBeCloseTo(20, 10)
    // The wrap segment runs 180°→360°, back down from 40° to 0°.
    expect(horizon.altitudeAt(270)).toBeCloseTo(20, 10)
  })

  it('never leaves the range spanned by its points', () => {
    const altitudes = carr.points.map((p) => p.altitude)
    const min = Math.min(...altitudes)
    const max = Math.max(...altitudes)

    for (let az = 0; az < 360; az += 0.5) {
      const altitude = carr.altitudeAt(az)
      expect(altitude).toBeGreaterThanOrEqual(min)
      expect(altitude).toBeLessThanOrEqual(max)
    }
  })
})

describe('Horizon visibility', () => {
  it('reports clearance above and below the obstruction', () => {
    // At azimuth 120° the treeline is at 27°.
    expect(carr.clearance(120, 40)).toBeCloseTo(13, 10)
    expect(carr.clearance(120, 20)).toBeCloseTo(-7, 10)
  })

  it('counts an object exactly on the horizon as visible', () => {
    expect(carr.isVisible(120, 27)).toBe(true)
    expect(carr.isVisible(120, 26.9)).toBe(false)
  })

  it('uses the flat horizon to mean altitude above zero', () => {
    expect(FLAT_HORIZON.isVisible(200, 0.1)).toBe(true)
    expect(FLAT_HORIZON.isVisible(200, -0.1)).toBe(false)
  })
})

describe('normalizeAzimuth', () => {
  it('wraps into 0–360', () => {
    expect(normalizeAzimuth(0)).toBe(0)
    expect(normalizeAzimuth(360)).toBe(0)
    expect(normalizeAzimuth(-90)).toBe(270)
    expect(normalizeAzimuth(450)).toBe(90)
    expect(normalizeAzimuth(-720.5)).toBeCloseTo(359.5, 10)
  })
})
