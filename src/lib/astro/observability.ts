/**
 * How long an object stays observable across a night.
 *
 * The search filters ask two questions — "is it above N degrees for at least
 * H hours?" and "is it above the observatory's own horizon for that long?" —
 * and both reduce to summing the time a clearance stays non-negative.
 *
 * This deliberately samples the trajectory coarsely and interpolates the
 * crossings rather than borrowing the bisecting scan behind `computeObjectEvents`.
 * A duration filter only needs to know whether the total clears an hours
 * threshold, and sub-10-minute precision is far finer than that decision.
 */

import { computeSunEvents } from './sun'
import { MS_PER_HOUR, nightWindow } from './time'
import { sampleTrajectory } from './trajectory'
import type { Horizon } from '../horizon'
import type {
  GeoLocation,
  SkyObject,
  TimeWindow,
  TrajectoryPoint,
} from './types'

/** Coarse enough to stay cheap over hundreds of objects, fine for an hours test. */
const DEFAULT_STEP_MINUTES = 10

/**
 * The window a duration filter measures over.
 *
 * The whole noon→noon night by default; when `duringNight` is set, only the
 * dark stretch between sunset and sunrise, so daytime hours above the horizon
 * don't count. `null` means the restriction leaves no time at all — the sun
 * never sets (polar day), so nothing is observable at night.
 */
export function observingWindow(
  date: Date,
  location: GeoLocation,
  duringNight: boolean,
): TimeWindow | null {
  const full = nightWindow(date)
  if (!duringNight) return full

  const sun = computeSunEvents(date, location)
  if (sun.polarDay) return null
  if (sun.polarNight) return full
  return {
    start: sun.sunset ?? full.start,
    end: sun.sunrise ?? full.end,
    midnight: full.midnight,
  }
}

/** Signed height of the object above the threshold at a point; ≥ 0 means clear. */
type Clearance = (point: TrajectoryPoint) => number

/**
 * Total hours across the sampled track where `clearance` is non-negative.
 *
 * Within a segment the clearance is treated as linear, so a segment straddling
 * the threshold contributes only the fraction on the clear side.
 */
function hoursAbove(
  points: readonly TrajectoryPoint[],
  clearance: Clearance,
): number {
  let hours = 0
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    const cFrom = clearance(from)
    const cTo = clearance(to)
    const segmentHours = (to.time.getTime() - from.time.getTime()) / MS_PER_HOUR

    if (cFrom >= 0 && cTo >= 0) {
      hours += segmentHours
    } else if (cFrom >= 0) {
      // Clear at the start, blocked by the end: up to the crossing.
      hours += (segmentHours * cFrom) / (cFrom - cTo)
    } else if (cTo >= 0) {
      // Blocked at the start, clear by the end: from the crossing on.
      hours += (segmentHours * cTo) / (cTo - cFrom)
    }
    // Blocked at both ends contributes nothing.
  }
  return hours
}

/** Hours the object spends above `degrees` of apparent altitude during `window`. */
export function hoursAboveAltitude(
  object: SkyObject,
  location: GeoLocation,
  window: TimeWindow,
  degrees: number,
  stepMinutes: number = DEFAULT_STEP_MINUTES,
): number {
  const { points } = sampleTrajectory(object, location, window, stepMinutes)
  return hoursAbove(points, (point) => point.altitude - degrees)
}

/** Hours the object spends above the observatory's horizon during `window`. */
export function hoursAboveHorizon(
  object: SkyObject,
  location: GeoLocation,
  window: TimeWindow,
  horizon: Horizon,
  stepMinutes: number = DEFAULT_STEP_MINUTES,
): number {
  const { points } = sampleTrajectory(object, location, window, stepMinutes)
  return hoursAbove(points, (point) =>
    horizon.clearance(point.azimuth, point.altitude),
  )
}
