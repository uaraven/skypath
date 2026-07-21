/**
 * Everything the all-sky chart draws, computed in one place.
 *
 * Same split as `model.ts`: the astronomy happens here so the Svelte component
 * stays presentational and the interesting parts stay testable in Node.
 */

import { horizontalAt } from '../astro/ephemeris'
import { computeMoonEvents, MOON } from '../astro/moon'
import { nightWindow } from '../astro/time'
import {
  peakAltitude,
  sampleTrajectory,
  type Trajectory,
} from '../astro/trajectory'
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
import { shortestTurn } from './marker'
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

/** The Moon on the dial: its above-horizon arcs, high point and phase. */
export interface MoonDial {
  /** Above-horizon runs, cut at the rim like the object's own arcs. */
  arcs: readonly (readonly TrajectoryPoint[])[]
  /** Highest sampled point, or null if the Moon never rises — where the glyph goes. */
  peak: TrajectoryPoint | null
  /** Illuminated fraction of the disc, 0–1, for the phase glyph. */
  illumination: number
  /** True while the Moon is waxing — which way the phase glyph is lit. */
  waxing: boolean
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
  /** The Moon's arcs and phase, or null when it wasn't asked for. */
  moon: MoonDial | null
}

export interface AllSkyChartInput {
  object: SkyObject
  location: GeoLocation
  date: Date
  horizon?: Horizon
  stepMinutes?: number
  /** Include the Moon's arcs and phase. Off by default. */
  includeMoon?: boolean
}

export function allSkyChartModel({
  object,
  location,
  date,
  horizon = FLAT_HORIZON,
  stepMinutes,
  includeMoon = false,
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
    // The Moon as target supplies its own phase glyph from the primary track;
    // otherwise it is an optional overlay. See the same branch in `model.ts`.
    moon:
      object.id === MOON.id
        ? moonDial(location, window, trajectory)
        : includeMoon
          ? moonDial(
              location,
              window,
              sampleTrajectory(MOON, location, window, stepMinutes),
            )
          : null,
  }
}

/** A `MoonDial` from an already-sampled Moon trajectory, split into arcs. */
function moonDial(
  location: GeoLocation,
  window: TimeWindow,
  trajectory: Trajectory,
): MoonDial {
  const events = computeMoonEvents(window, location)
  return {
    arcs: aboveHorizonArcs(trajectory.points),
    peak: peakAltitude(trajectory),
    illumination: events.illumination,
    waxing: events.phaseAngle < 180,
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
