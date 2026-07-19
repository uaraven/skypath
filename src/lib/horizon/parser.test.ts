import { describe, expect, it } from 'vitest'
import { formatHorizon, horizonFromText, parseHorizon } from './parser'
import carrHorizon from './fixtures/e.c.carr-horizon.txt?raw'

describe('parseHorizon', () => {
  it('parses a real NINA horizon file', () => {
    const { points, issues } = parseHorizon(carrHorizon)

    expect(issues).toEqual([])
    expect(points).toHaveLength(12)
    expect(points[0]).toEqual({ azimuth: 5, altitude: 55 })
    expect(points[11]).toEqual({ azimuth: 335, altitude: 45 })
  })

  it('sorts points by azimuth regardless of file order', () => {
    const { points } = parseHorizon('180 20\n90 10\n270 30')

    expect(points.map((p) => p.azimuth)).toEqual([90, 180, 270])
  })

  it('accepts tabs, commas and runs of spaces as separators', () => {
    const { points, issues } = parseHorizon('10\t20\n30,40\n50   60')

    expect(issues).toEqual([])
    expect(points).toEqual([
      { azimuth: 10, altitude: 20 },
      { azimuth: 30, altitude: 40 },
      { azimuth: 50, altitude: 60 },
    ])
  })

  it('ignores blank lines, comments and trailing whitespace', () => {
    const { points, issues } = parseHorizon(
      '# measured 2026-07-18\n\n  10 20  \n30 40 ; treeline\n\n',
    )

    expect(issues).toEqual([])
    expect(points).toEqual([
      { azimuth: 10, altitude: 20 },
      { azimuth: 30, altitude: 40 },
    ])
  })

  it('accepts decimal degrees', () => {
    const { points, issues } = parseHorizon('12.5 3.25\n347.75 -1.5')

    expect(issues).toEqual([])
    expect(points).toEqual([
      { azimuth: 12.5, altitude: 3.25 },
      { azimuth: 347.75, altitude: -1.5 },
    ])
  })

  it('reports lines that are not two numbers, and keeps the rest', () => {
    const { points, issues } = parseHorizon('10 20\nnonsense\n30 40 50\n60 70')

    expect(points.map((p) => p.azimuth)).toEqual([10, 60])
    expect(issues).toHaveLength(2)
    expect(issues[0]).toMatchObject({ line: 2, text: 'nonsense' })
    expect(issues[1]).toMatchObject({ line: 3 })
    expect(issues[1].message).toMatch(/expected two numbers/)
  })

  it('rejects out-of-range azimuths and altitudes', () => {
    const { points, issues } = parseHorizon('400 10\n-5 10\n20 95\n30 -95')

    expect(points).toEqual([])
    expect(issues.map((i) => i.line)).toEqual([1, 2, 3, 4])
    expect(issues[0].message).toMatch(/azimuth 400 is outside/)
    expect(issues[2].message).toMatch(/altitude 95 is outside/)
  })

  it('folds a closing 360° row onto 0°', () => {
    const { points, issues } = parseHorizon('0 15\n180 25\n360 15')

    expect(issues).toEqual([])
    expect(points).toEqual([
      { azimuth: 0, altitude: 15 },
      { azimuth: 180, altitude: 25 },
    ])
  })

  it('flags a contradictory duplicate azimuth and keeps the first value', () => {
    const { points, issues } = parseHorizon('10 20\n10 35')

    expect(points).toEqual([{ azimuth: 10, altitude: 20 }])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ line: 2 })
    expect(issues[0].message).toMatch(/already set to 20/)
  })

  it('accepts a harmless duplicate silently', () => {
    const { points, issues } = parseHorizon('10 20\n10 20')

    expect(points).toEqual([{ azimuth: 10, altitude: 20 }])
    expect(issues).toEqual([])
  })

  it('handles CRLF line endings', () => {
    const { points, issues } = parseHorizon('10 20\r\n30 40\r\n')

    expect(issues).toEqual([])
    expect(points).toHaveLength(2)
  })

  it('returns nothing for empty input', () => {
    expect(parseHorizon('')).toEqual({ points: [], issues: [] })
    expect(parseHorizon('   \n\n')).toEqual({ points: [], issues: [] })
  })
})

describe('horizonFromText', () => {
  it('builds a usable horizon', () => {
    const horizon = horizonFromText(carrHorizon)

    expect(horizon.points).toHaveLength(12)
    expect(horizon.altitudeAt(5)).toBe(55)
  })

  it('returns a flat horizon for empty text', () => {
    expect(horizonFromText('').isFlat).toBe(true)
  })

  it('memoizes repeated calls with the same text', () => {
    expect(horizonFromText(carrHorizon)).toBe(horizonFromText(carrHorizon))
  })

  it('reparses when the text changes', () => {
    const first = horizonFromText('10 20')
    const second = horizonFromText('10 30')

    expect(second).not.toBe(first)
    expect(second.altitudeAt(10)).toBe(30)
  })
})

describe('formatHorizon', () => {
  it('round-trips through the parser', () => {
    const { points } = parseHorizon(carrHorizon)

    expect(parseHorizon(formatHorizon(points)).points).toEqual(points)
  })
})
