/**
 * Everything the altitude chart draws, computed in one place.
 *
 * The Svelte component stays presentational: it turns this into SVG and does
 * no astronomy of its own, which keeps the interesting parts testable in Node.
 */

import { sampleTrajectory, peakAltitude } from '../astro/trajectory'
import { nightWindow } from '../astro/time'
import type { GeoLocation, SkyObject, TrajectoryPoint } from '../astro/types'
import { FLAT_HORIZON, type Horizon } from '../horizon'
import { skyBands, type SkyBand } from './sky-bands'
import type { TimeWindow } from '../astro/types'

/** The observer's horizon altitude in the direction the object is in, at time. */
export interface HorizonSample {
  time: Date
  altitude: number
}

export interface AltitudeChartModel {
  object: SkyObject
  window: TimeWindow
  points: readonly TrajectoryPoint[]
  /**
   * The horizon as an altitude-vs-time curve.
   *
   * The obstruction that matters at any moment is the one the object is
   * *behind*, so this is the horizon sampled along the object's azimuth track
   * — not a fixed line. It moves as the object swings across the sky, which is
   * why the reference rendering shows it as a jagged curve.
   */
  horizonTrack: readonly HorizonSample[]
  bands: readonly SkyBand[]
  /** Highest sampled point, or null if the object never rises. */
  peak: TrajectoryPoint | null
}

export interface AltitudeChartInput {
  object: SkyObject
  location: GeoLocation
  date: Date
  horizon?: Horizon
  stepMinutes?: number
}

export function altitudeChartModel({
  object,
  location,
  date,
  horizon = FLAT_HORIZON,
  stepMinutes,
}: AltitudeChartInput): AltitudeChartModel {
  const window = nightWindow(date)
  const trajectory = sampleTrajectory(object, location, window, stepMinutes)

  return {
    object,
    window,
    points: trajectory.points,
    horizonTrack: trajectory.points.map((point) => ({
      time: point.time,
      altitude: horizon.altitudeAt(point.azimuth),
    })),
    bands: skyBands(window, location),
    peak: peakAltitude(trajectory),
  }
}

/** True when the object clears the observer's horizon at some point tonight. */
export function everVisible(model: AltitudeChartModel): boolean {
  return model.points.some(
    (point, i) => point.altitude > model.horizonTrack[i].altitude,
  )
}
