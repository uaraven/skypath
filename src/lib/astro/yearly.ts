/**
 * Altitude sampled at local midnight across a calendar year — the "when in
 * the year is this object well placed" view, distinct from a single night's
 * trajectory (`trajectory.ts`).
 */

import { horizontalAt } from './ephemeris'
import type { GeoLocation, SkyObject, TrajectoryPoint } from './types'

/** Local midnight of every day of `year`, Jan 1 through Dec 31. */
export function dailyMidnights(year: number): Date[] {
  const dates: Date[] = []
  const cursor = new Date(year, 0, 1)
  cursor.setHours(0, 0, 0, 0)

  while (cursor.getFullYear() === year) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

/** Altitude/azimuth at local midnight for every day of `year`. */
export function yearlyAltitudeSamples(
  object: SkyObject,
  location: GeoLocation,
  year: number,
): TrajectoryPoint[] {
  return dailyMidnights(year).map((time) => ({
    time,
    ...horizontalAt(object, time, location),
  }))
}
