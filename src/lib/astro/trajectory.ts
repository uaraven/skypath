import { horizontalAt } from './ephemeris'
import { MS_PER_MINUTE, nightWindow } from './time'
import type {
  GeoLocation,
  SkyObject,
  TimeWindow,
  TrajectoryPoint,
} from './types'

/**
 * Sampling interval in minutes. At 5 minutes an object near the meridian moves
 * well under a degree between samples, so the drawn curve is smooth at chart
 * resolution. Event times are refined separately rather than read off these
 * samples.
 */
export const DEFAULT_STEP_MINUTES = 5

export interface Trajectory {
  object: SkyObject
  window: TimeWindow
  points: TrajectoryPoint[]
}

/** Sample an object's altitude/azimuth at regular steps across a window. */
export function sampleTrajectory(
  object: SkyObject,
  location: GeoLocation,
  window: TimeWindow,
  stepMinutes: number = DEFAULT_STEP_MINUTES,
): Trajectory {
  const step = stepMinutes * MS_PER_MINUTE
  const startMs = window.start.getTime()
  const endMs = window.end.getTime()

  const points: TrajectoryPoint[] = []
  for (let ms = startMs; ms <= endMs; ms += step) {
    const time = new Date(ms)
    points.push({ time, ...horizontalAt(object, time, location) })
  }

  // Guarantee the curve reaches the right edge even when the window length
  // isn't a whole number of steps (DST transitions make it 23 or 25 hours).
  const last = points[points.length - 1]
  if (last.time.getTime() < endMs) {
    const time = new Date(endMs)
    points.push({ time, ...horizontalAt(object, time, location) })
  }

  return { object, window, points }
}

/** Convenience wrapper: sample across the night beginning on `date`. */
export function trajectoryForDate(
  object: SkyObject,
  location: GeoLocation,
  date: Date,
  stepMinutes: number = DEFAULT_STEP_MINUTES,
): Trajectory {
  return sampleTrajectory(object, location, nightWindow(date), stepMinutes)
}

/** Highest sampled point, or null if the trajectory is empty. */
export function peakAltitude(trajectory: Trajectory): TrajectoryPoint | null {
  return trajectory.points.reduce<TrajectoryPoint | null>(
    (best, p) => (best === null || p.altitude > best.altitude ? p : best),
    null,
  )
}
