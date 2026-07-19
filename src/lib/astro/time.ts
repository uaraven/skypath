import type { TimeWindow } from './types'

export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 3_600_000

/**
 * Local noon on the given calendar date.
 *
 * Everything is anchored on noon rather than midnight so that a night belongs
 * to a single window: sunset, the whole night, and sunrise all land inside
 * one noon→noon span. Searching from midnight instead would push the evening
 * twilight events into the *following* night.
 *
 * "Local" means the browser's timezone throughout — see the timezone
 * limitation noted in the implementation plan.
 */
export function localNoon(date: Date): Date {
  const noon = new Date(date)
  noon.setHours(12, 0, 0, 0)
  return noon
}

/** The noon→noon window centred on local midnight following `date`. */
export function nightWindow(date: Date): TimeWindow {
  const start = localNoon(date)
  const midnight = new Date(start)
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end, midnight }
}

/** Fraction (0–1) of the way through the window — the charts' x axis. */
export function windowFraction(window: TimeWindow, time: Date): number {
  const span = window.end.getTime() - window.start.getTime()
  return (time.getTime() - window.start.getTime()) / span
}

/** Length of the window in hours. Not always 24 — DST shifts it by an hour. */
export function windowHours(window: TimeWindow): number {
  return (window.end.getTime() - window.start.getTime()) / MS_PER_HOUR
}
