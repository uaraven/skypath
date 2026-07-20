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
import { shortestTurn } from './marker'
import { compassPoint } from './polar'
import { skyBands, type SkyBand } from './sky-bands'
import type { TimeWindow } from '../astro/types'

/** The observer's horizon altitude in the direction the object is in, at time. */
export interface HorizonSample {
  time: Date
  altitude: number
}

/** A moment the object passes one of the eight compass points, for the top axis. */
export interface CardinalCrossing {
  time: Date
  /** `N`, `NE`, … — the compass point the object's azimuth crosses. */
  label: string
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
  /**
   * Where the object crosses each compass point while above the horizon, in
   * time order — the top axis marks these so you can read which way to look.
   */
  cardinals: readonly CardinalCrossing[]
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
    bands: cachedBands(window, location),
    peak: peakAltitude(trajectory),
    cardinals: cardinalCrossings(trajectory.points),
  }
}

/** The eight compass azimuths, north first, matching `compassPoint`. */
const CARDINAL_AZIMUTHS = [0, 45, 90, 135, 180, 225, 270, 315]

/**
 * Every moment the object's azimuth passes a compass point while it is up.
 *
 * Each segment of the track sweeps a small arc; a compass point falls inside it
 * when a multiple-of-360 shift of that azimuth lands between the two ends. The
 * sweep is taken the short way round (`shortestTurn`) so an object crossing due
 * north from 359° to 1° is one small step east, not a lap of the whole sky.
 * Crossings below the horizon are dropped — the curve is not drawn there, so a
 * letter would point at nothing.
 */
export function cardinalCrossings(
  points: readonly TrajectoryPoint[],
): CardinalCrossing[] {
  const crossings: CardinalCrossing[] = []

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]
    const to = points[i]
    if (from.altitude < 0 && to.altitude < 0) continue

    const delta = shortestTurn(from.azimuth, to.azimuth)
    if (delta === 0) continue

    for (const target of CARDINAL_AZIMUTHS) {
      for (let turn = -360; turn <= 360; turn += 360) {
        // Fraction along the segment where the sweep reaches this azimuth.
        // Half-open so a crossing exactly on a shared sample isn't counted twice.
        const fraction = (target + turn - from.azimuth) / delta
        if (fraction < 0 || fraction >= 1) continue

        const altitude =
          from.altitude + fraction * (to.altitude - from.altitude)
        if (altitude < 0) continue

        crossings.push({
          time: new Date(
            from.time.getTime() +
              fraction * (to.time.getTime() - from.time.getTime()),
          ),
          label: compassPoint(target),
        })
      }
    }
  }

  return crossings
}

/**
 * The twilight bands depend only on the date and the observer — not on the
 * object — so a list of charts showing different targets for one night all
 * want the same ones. `skyBands` scans the sun's altitude across the window,
 * which is by far the most expensive part of building a model, and the search
 * results build one model per row on every keystroke.
 *
 * A single remembered entry is enough: those rows are computed back to back
 * with identical arguments, so everything after the first row hits it.
 */
let lastBands: { key: string; bands: readonly SkyBand[] } | null = null

function cachedBands(
  window: TimeWindow,
  location: GeoLocation,
): readonly SkyBand[] {
  const key = `${window.start.getTime()}|${window.end.getTime()}|${location.latitude}|${location.longitude}`
  if (lastBands?.key !== key) {
    lastBands = { key, bands: skyBands(window, location) }
  }
  return lastBands.bands
}

/** True when the object clears the observer's horizon at some point tonight. */
export function everVisible(model: AltitudeChartModel): boolean {
  return model.points.some(
    (point, i) => point.altitude > model.horizonTrack[i].altitude,
  )
}
