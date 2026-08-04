import { describe, expect, it } from 'vitest'
import { horizontalAt } from './ephemeris'
import { dailyMidnights, yearlyAltitudeSamples } from './yearly'
import type { DeepSkyObject, GeoLocation } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }

const M13: DeepSkyObject = {
  id: 'M13',
  name: 'M13',
  kind: 'deep-sky',
  ra: 16.69479,
  dec: 36.45986,
}

describe('dailyMidnights', () => {
  it('starts at local midnight on Jan 1', () => {
    const [first] = dailyMidnights(2026)
    expect(first).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
  })

  it('steps by one day and stays within the year', () => {
    const dates = dailyMidnights(2026)
    for (let i = 1; i < dates.length; i++) {
      const diffDays =
        (dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000
      expect(diffDays).toBe(1)
    }
    expect(dates.every((d) => d.getFullYear() === 2026)).toBe(true)
  })

  it('yields 365 days in a common year and 366 in a leap year', () => {
    expect(dailyMidnights(2026)).toHaveLength(365)
    expect(dailyMidnights(2028)).toHaveLength(366)
  })

  it('ends on Dec 31', () => {
    const dates = dailyMidnights(2026)
    const last = dates[dates.length - 1]
    expect(last.getMonth()).toBe(11)
    expect(last.getDate()).toBe(31)
  })
})

describe('yearlyAltitudeSamples', () => {
  it('samples every day, matching horizontalAt directly', () => {
    const points = yearlyAltitudeSamples(M13, KYIV, 2026)
    expect(points).toHaveLength(dailyMidnights(2026).length)

    const spot = points[10]
    expect(spot.altitude).toBeCloseTo(
      horizontalAt(M13, spot.time, KYIV).altitude,
      6,
    )
  })
})
