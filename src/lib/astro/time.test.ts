import { describe, expect, it } from 'vitest'
import { localNoon, nightWindow, windowFraction, windowHours } from './time'

describe('nightWindow', () => {
  it('runs from local noon to local noon the next day', () => {
    const window = nightWindow(new Date(2026, 6, 18, 3, 27))

    expect(window.start).toEqual(new Date(2026, 6, 18, 12, 0, 0, 0))
    expect(window.end).toEqual(new Date(2026, 6, 19, 12, 0, 0, 0))
  })

  it('centres on the midnight between the two noons', () => {
    const window = nightWindow(new Date(2026, 6, 18))

    expect(window.midnight).toEqual(new Date(2026, 6, 19, 0, 0, 0, 0))
    expect(windowFraction(window, window.midnight)).toBeCloseTo(0.5, 10)
  })

  it('ignores the time of day it is given', () => {
    const early = nightWindow(new Date(2026, 6, 18, 0, 1))
    const late = nightWindow(new Date(2026, 6, 18, 23, 59))

    expect(early).toEqual(late)
  })

  it('rolls over month and year boundaries', () => {
    const window = nightWindow(new Date(2026, 11, 31))

    expect(window.end).toEqual(new Date(2027, 0, 1, 12, 0, 0, 0))
  })

  it('spans 24 hours with no DST transition', () => {
    expect(windowHours(nightWindow(new Date(2026, 6, 18)))).toBe(24)
  })
})

describe('windowFraction', () => {
  it('is 0 at the start and 1 at the end', () => {
    const window = nightWindow(new Date(2026, 6, 18))

    expect(windowFraction(window, window.start)).toBe(0)
    expect(windowFraction(window, window.end)).toBe(1)
  })
})

describe('localNoon', () => {
  it('zeroes out the sub-hour fields', () => {
    expect(localNoon(new Date(2026, 6, 18, 5, 43, 21, 999))).toEqual(
      new Date(2026, 6, 18, 12, 0, 0, 0),
    )
  })
})
