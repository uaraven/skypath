import { describe, expect, it } from 'vitest'
import {
  altitudeRadius,
  azimuthLabel,
  closedPath,
  compassPoint,
  obstructionPath,
  polarPoint,
  radialPoint,
  ringAltitudes,
  spokeAzimuths,
  type PolarDial,
} from './polar'

const DIAL: PolarDial = { cx: 100, cy: 100, radius: 90 }

describe('altitudeRadius', () => {
  it('puts the zenith at the centre and the horizon on the rim', () => {
    expect(altitudeRadius(90, DIAL)).toBe(0)
    expect(altitudeRadius(0, DIAL)).toBe(90)
  })

  it('is linear in altitude', () => {
    expect(altitudeRadius(45, DIAL)).toBeCloseTo(45, 10)
    expect(altitudeRadius(30, DIAL)).toBeCloseTo(60, 10)
  })

  it('clamps rather than leaving the dial', () => {
    expect(altitudeRadius(-20, DIAL)).toBe(90)
    expect(altitudeRadius(120, DIAL)).toBe(0)
  })
})

describe('polarPoint', () => {
  // North up, azimuth clockwise: this is the orientation the whole chart
  // rests on, so pin all four cardinals rather than trusting one.
  it('places north up, east right, south down and west left', () => {
    expect(polarPoint(0, 0, DIAL)).toMatchObject({ x: 100, y: 10 })

    const east = polarPoint(90, 0, DIAL)
    expect(east.x).toBeCloseTo(190, 6)
    expect(east.y).toBeCloseTo(100, 6)

    const south = polarPoint(180, 0, DIAL)
    expect(south.x).toBeCloseTo(100, 6)
    expect(south.y).toBeCloseTo(190, 6)

    const west = polarPoint(270, 0, DIAL)
    expect(west.x).toBeCloseTo(10, 6)
    expect(west.y).toBeCloseTo(100, 6)
  })

  it('collapses every azimuth onto the centre at the zenith', () => {
    for (const azimuth of [0, 37, 180, 315]) {
      const point = polarPoint(azimuth, 90, DIAL)
      expect(point.x).toBeCloseTo(100, 6)
      expect(point.y).toBeCloseTo(100, 6)
    }
  })

  it('wraps azimuths past 360°', () => {
    const wrapped = polarPoint(450, 30, DIAL)
    const plain = polarPoint(90, 30, DIAL)
    expect(wrapped.x).toBeCloseTo(plain.x, 6)
    expect(wrapped.y).toBeCloseTo(plain.y, 6)
  })
})

describe('grid values', () => {
  it('rings the dial between the centre and the rim, excluding both', () => {
    expect(ringAltitudes(15)).toEqual([15, 30, 45, 60, 75])
    expect(ringAltitudes(30)).toEqual([30, 60])
  })

  it('spokes the full circle without repeating north', () => {
    expect(spokeAzimuths(45)).toEqual([0, 45, 90, 135, 180, 225, 270, 315])
    expect(spokeAzimuths(90)).toEqual([0, 90, 180, 270])
  })

  it('names the cardinals and numbers the rest', () => {
    expect(spokeAzimuths().map(azimuthLabel)).toEqual([
      'N',
      '45',
      'E',
      '135',
      'S',
      '225',
      'W',
      '315',
    ])
  })
})

describe('compassPoint', () => {
  it('names the eight sectors', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(90)).toBe('E')
    expect(compassPoint(225)).toBe('SW')
  })

  it('rounds to the nearest sector and wraps at north', () => {
    expect(compassPoint(20)).toBe('N')
    expect(compassPoint(30)).toBe('NE')
    expect(compassPoint(350)).toBe('N')
    expect(compassPoint(-10)).toBe('N')
  })
})

describe('closedPath', () => {
  it('closes the polygon', () => {
    const d = closedPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ])
    expect(d).toBe('M0 0 L10 0 L10 10 Z')
  })

  it('is empty for no points', () => {
    expect(closedPath([])).toBe('')
  })
})

describe('obstructionPath', () => {
  const clear = [
    polarPoint(0, 30, DIAL),
    polarPoint(120, 30, DIAL),
    polarPoint(240, 30, DIAL),
  ]

  it('draws the full disc and then the clear sky as a hole', () => {
    const d = obstructionPath(clear, DIAL)
    // Two subpaths: the disc's arcs, then the clear-sky polygon. The caller
    // pairs this with fill-rule="evenodd" to punch the second out of the first.
    expect(d.match(/M/g)).toHaveLength(2)
    expect(d.match(/A/g)).toHaveLength(2)
    expect(d).toContain(closedPath(clear))
  })

  it('is empty when there is no profile to punch out', () => {
    expect(obstructionPath([], DIAL)).toBe('')
  })
})

describe('radialPoint', () => {
  it('places labels outside the rim', () => {
    const label = radialPoint(180, DIAL.radius + 10, DIAL)
    expect(label.y).toBeCloseTo(200, 6)
  })
})
