/**
 * Everything the all-sky chart draws, computed in one place.
 *
 * Same split as `model.ts`: the astronomy happens here so the Svelte component
 * stays presentational and the interesting parts stay testable in Node.
 */

import { horizontalAt } from '../astro/ephemeris'
import { nightWindow } from '../astro/time'
import { peakAltitude, sampleTrajectory } from '../astro/trajectory'
import type {
  GeoLocation,
  SkyObject,
  TimeWindow,
  TrajectoryPoint,
} from '../astro/types'
import {
  FLAT_HORIZON,
  normalizeAzimuth,
  type Horizon,
  type HorizonPoint,
} from '../horizon'
import { hourTicks } from './scales'

/**
 * How finely the horizon profile is sampled around the dial, in degrees.
 *
 * The profile is drawn as a polygon, and its vertices are the only places the
 * measured horizon is reproduced exactly. One degree keeps the straight
 * stretches between two sparse measurements looking straight while still
 * putting a vertex within half a degree of every corner in the file.
 */
export const HORIZON_STEP_DEGREES = 1

/** A whole local hour on the object's track, for the time-direction marks. */
export interface HourMark extends TrajectoryPoint {
  /** True on the 3-hourly marks, which are the ones that carry a label. */
  labelled: boolean
}

export interface AllSkyChartModel {
  object: SkyObject
  window: TimeWindow
  /**
   * The object's track, split into the runs where it is above the mathematical
   * horizon.
   *
   * A polar dial has no room below the rim, so — unlike the altitude chart,
   * which runs a set object flat along its baseline — the track is cut rather
   * than clamped. Each run starts and ends exactly on the rim: the sample
   * either side of a crossing is interpolated to altitude 0, so an arc does not
   * visibly start short of the edge.
   */
  arcs: readonly (readonly TrajectoryPoint[])[]
  /** Whole-hour positions on the track, above the horizon only. */
  hourMarks: readonly HourMark[]
  /** The observer's horizon, densely sampled all the way round from north. */
  horizonProfile: readonly HorizonPoint[]
  /** Highest sampled point, or null if the object never rises. */
  peak: TrajectoryPoint | null
  /** True when the object clears the *observer's* horizon at some point. */
  everClears: boolean
}

export interface AllSkyChartInput {
  object: SkyObject
  location: GeoLocation
  date: Date
  horizon?: Horizon
  stepMinutes?: number
}

export function allSkyChartModel({
  object,
  location,
  date,
  horizon = FLAT_HORIZON,
  stepMinutes,
}: AllSkyChartInput): AllSkyChartModel {
  const window = nightWindow(date)
  const trajectory = sampleTrajectory(object, location, window, stepMinutes)

  return {
    object,
    window,
    arcs: aboveHorizonArcs(trajectory.points),
    hourMarks: hourMarks(object, location, window),
    horizonProfile: horizonProfile(horizon),
    peak: peakAltitude(trajectory),
    everClears: trajectory.points.some((point) =>
      horizon.isVisible(point.azimuth, point.altitude),
    ),
  }
}

/**
 * Split a track into its above-horizon runs, ending each one on the rim.
 *
 * The crossing is interpolated linearly between the two samples that straddle
 * it rather than searched for properly: this is a drawing detail worth a
 * fraction of a pixel, not an event time. Phase 6 computes the real ones.
 */
export function aboveHorizonArcs(
  points: readonly TrajectoryPoint[],
): TrajectoryPoint[][] {
  const arcs: TrajectoryPoint[][] = []
  let current: TrajectoryPoint[] | null = null

  points.forEach((point, i) => {
    const previous = i > 0 ? points[i - 1] : null

    if (point.altitude >= 0) {
      if (current === null) {
        current = []
        if (previous) current.push(rimCrossing(previous, point))
        arcs.push(current)
      }
      current.push(point)
    } else if (current !== null) {
      current.push(rimCrossing(previous!, point))
      current = null
    }
  })

  return arcs
}

/** Where the segment between two samples crosses altitude 0. */
function rimCrossing(
  from: TrajectoryPoint,
  to: TrajectoryPoint,
): TrajectoryPoint {
  const span = from.altitude - to.altitude
  const fraction = span === 0 ? 0 : from.altitude / span

  return {
    time: new Date(
      from.time.getTime() +
        fraction * (to.time.getTime() - from.time.getTime()),
    ),
    altitude: 0,
    azimuth: normalizeAzimuth(
      from.azimuth + fraction * shortestTurn(from.azimuth, to.azimuth),
    ),
  }
}

/**
 * The signed azimuth change from `from` to `to`, taking the short way round.
 *
 * Straight subtraction would send an object crossing north from 359° to 1°
 * sweeping backwards through the whole sky.
 */
function shortestTurn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

/**
 * Whole-hour positions, computed directly rather than picked out of the track.
 *
 * The track's sampling step is the caller's to choose and need not land on the
 * hour; asking the ephemeris for two dozen extra positions is cheaper than
 * constraining it.
 */
function hourMarks(
  object: SkyObject,
  location: GeoLocation,
  window: TimeWindow,
): HourMark[] {
  return hourTicks(window, 1)
    .map((time) => ({
      time,
      ...horizontalAt(object, time, location),
      labelled: time.getHours() % 3 === 0,
    }))
    .filter((mark) => mark.altitude >= 0)
}

/** The horizon sampled all the way round, starting at north. */
function horizonProfile(horizon: Horizon): HorizonPoint[] {
  const profile: HorizonPoint[] = []
  for (let azimuth = 0; azimuth < 360; azimuth += HORIZON_STEP_DEGREES) {
    profile.push({ azimuth, altitude: horizon.altitudeAt(azimuth) })
  }
  return profile
}
