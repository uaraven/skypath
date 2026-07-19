/**
 * The named moments of an object's night: when it rises, when it clears the
 * observer's own horizon, when it culminates, and when it goes back down.
 *
 * Two different horizons are in play and they are found two different ways.
 * The mathematical horizon (altitude 0°) is left to astronomy-engine's
 * `SearchRiseSet`, which knows about the Moon's semidiameter and parallax and
 * is the authority a printed almanac agrees with. The observer's horizon is a
 * measured profile that varies with azimuth, so no library search can solve
 * it: it is found by scanning `altitude(t) − horizonAltitude(azimuth(t))` for
 * sign changes and bisecting them.
 *
 * This module is the one place in `astro/` that knows about the horizon
 * module. That is deliberate — a horizon is a property of the observer, like
 * the location, and every alternative (a callback, a duplicate of the
 * interpolation) was worse than the import.
 */

import { SearchHourAngle, SearchRiseSet } from 'astronomy-engine'
import { horizontalAt, toObserver, withEngineBody } from './ephemeris'
import { computeMoonEvents, type MoonEvents } from './moon'
import { computeSunEvents, type SunEvents } from './sun'
import { MS_PER_MINUTE, nightWindow, windowHours } from './time'
import { FLAT_HORIZON, type Horizon } from '../horizon'
import type {
  GeoLocation,
  SkyObject,
  TimeWindow,
  TrajectoryPoint,
} from './types'

/**
 * One continuous stretch of the window during which the object is above the
 * observer's horizon.
 *
 * `start` and `end` are always real points on the track, but they are only
 * *events* when the corresponding `open` flag is false: an object already up
 * at local noon has a span that opens at the window edge, and calling that a
 * rise would be a lie.
 */
export interface AboveHorizonSpan {
  start: TrajectoryPoint
  end: TrajectoryPoint
  /** The object was already up when the window began. */
  openStart: boolean
  /** The object was still up when the window ended. */
  openEnd: boolean
}

export interface ObjectEvents {
  object: SkyObject
  window: TimeWindow
  /** Crossings of the mathematical horizon — altitude 0°, refracted. */
  rise: TrajectoryPoint | null
  set: TrajectoryPoint | null
  /** Crossings of the observer's measured horizon. */
  clears: TrajectoryPoint | null
  hides: TrajectoryPoint | null
  /** Every above-the-observer's-horizon stretch, in order. */
  spans: readonly AboveHorizonSpan[]
  /** Upper culmination: the night's highest point, and where to look for it. */
  transit: TrajectoryPoint | null
  /** Never sets below altitude 0° during the window. */
  circumpolar: boolean
  /** Never reaches altitude 0° during the window. */
  neverRises: boolean
  /** Clears the observer's horizon at some point during the window. */
  everClears: boolean
}

export interface ObjectEventsInput {
  object: SkyObject
  location: GeoLocation
  window: TimeWindow
  horizon?: Horizon
}

/**
 * Sampling step for the horizon scan, in minutes.
 *
 * An object moves at most ~0.25°/minute, so two minutes cannot step over a
 * crossing of anything but a spike in the horizon profile far narrower than a
 * real NINA file records.
 */
const SCAN_MINUTES = 2

/** Crossings are bisected to the second; finer would not survive display. */
const REFINE_MS = 1000

export function computeObjectEvents({
  object,
  location,
  window,
  horizon = FLAT_HORIZON,
}: ObjectEventsInput): ObjectEvents {
  const at = (time: Date): TrajectoryPoint => ({
    time,
    ...horizontalAt(object, time, location),
  })

  const rise = searchRiseSet(object, location, window, 1)
  const set = searchRiseSet(object, location, window, -1)

  const spans = aboveHorizonSpans(object, location, window, horizon, at)
  const firstRise = spans.find((span) => !span.openStart) ?? null
  const lastSet = [...spans].reverse().find((span) => !span.openEnd) ?? null

  // No crossing either way means the object stays on one side of the horizon
  // all night; its altitude at midnight says which. Same reasoning as the
  // sun's polar day / polar night.
  const neverCrosses = rise === null && set === null
  const midnightAltitude = horizontalAt(
    object,
    window.midnight,
    location,
  ).altitude

  return {
    object,
    window,
    rise,
    set,
    clears: firstRise?.start ?? null,
    hides: lastSet?.end ?? null,
    spans,
    transit: transit(object, location, window, at),
    circumpolar: neverCrosses && midnightAltitude > 0,
    neverRises: neverCrosses && midnightAltitude <= 0,
    everClears: spans.length > 0,
  }
}

/**
 * Everything the times panel lists, computed in one place.
 *
 * Same split as the chart models: the astronomy happens here so the Svelte
 * component only formats and lays out, and all three groups share one window.
 */
export interface NightEvents {
  window: TimeWindow
  target: ObjectEvents
  sun: SunEvents
  moon: MoonEvents
}

export interface NightEventsInput {
  object: SkyObject
  location: GeoLocation
  date: Date
  horizon?: Horizon
}

export function nightEvents({
  object,
  location,
  date,
  horizon,
}: NightEventsInput): NightEvents {
  const window = nightWindow(date)

  return {
    window,
    target: computeObjectEvents({ object, location, window, horizon }),
    sun: computeSunEvents(date, location),
    moon: computeMoonEvents(window, location),
  }
}

/**
 * First crossing of altitude 0° in `direction` after the window starts.
 *
 * Objects whose sidereal day is shorter than the window can rise twice in it;
 * taking the first crossing each way is the same convention `computeSunEvents`
 * uses, and it picks out the evening's rise and the morning's set for anything
 * observed around midnight.
 */
function searchRiseSet(
  object: SkyObject,
  location: GeoLocation,
  window: TimeWindow,
  direction: 1 | -1,
): TrajectoryPoint | null {
  const observer = toObserver(location)
  const limitDays = windowHours(window) / 24

  const found = withEngineBody(object, (body) =>
    SearchRiseSet(body, observer, direction, window.start, limitDays),
  )
  if (!found) return null

  return { time: found.date, ...horizontalAt(object, found.date, location) }
}

/**
 * Upper culmination — the moment the object crosses the meridian, which is
 * where its altitude peaks.
 *
 * Solved rather than read off the sampled trajectory: the peak of a smooth
 * curve is exactly where sampling is least informative, and a 5-minute step
 * would round the transit time to the nearest 5 minutes.
 *
 * Null is possible: the Moon's transits are ~24h50m apart, so some nights have
 * none inside a noon→noon window. That is a real answer, not a failure.
 */
function transit(
  object: SkyObject,
  location: GeoLocation,
  window: TimeWindow,
  at: (time: Date) => TrajectoryPoint,
): TrajectoryPoint | null {
  const observer = toObserver(location)
  const found = withEngineBody(object, (body) =>
    SearchHourAngle(body, observer, 0, window.start, 1),
  )
  if (!found || found.time.date > window.end) return null

  return at(found.time.date)
}

/**
 * Scan the window for the stretches where the object clears the observer's
 * horizon.
 *
 * Sign changes of the clearance are bisected to the second, so the reported
 * time is as good as the horizon data behind it. Between two measured azimuths
 * the profile is interpolated, which means a crossing found on a steep
 * segment inherits whatever error that interpolation has — nothing here can
 * improve on a horizon file with points every 30°.
 */
function aboveHorizonSpans(
  object: SkyObject,
  location: GeoLocation,
  window: TimeWindow,
  horizon: Horizon,
  at: (time: Date) => TrajectoryPoint,
): AboveHorizonSpan[] {
  const clearanceAt = (time: Date): number => {
    const point = at(time)
    return horizon.clearance(point.azimuth, point.altitude)
  }

  const step = SCAN_MINUTES * MS_PER_MINUTE
  const startMs = window.start.getTime()
  const endMs = window.end.getTime()

  const spans: AboveHorizonSpan[] = []
  let previous = window.start
  let wasUp = clearanceAt(window.start) >= 0
  let spanStart: TrajectoryPoint | null = wasUp ? at(window.start) : null
  let openStart = wasUp

  for (let ms = startMs + step; ms <= endMs + step; ms += step) {
    const time = new Date(Math.min(ms, endMs))
    const isUp = clearanceAt(time) >= 0

    if (isUp !== wasUp) {
      const crossing = at(refineCrossing(previous, time, wasUp, clearanceAt))
      if (isUp) {
        spanStart = crossing
        openStart = false
      } else {
        spans.push({
          start: spanStart!,
          end: crossing,
          openStart,
          openEnd: false,
        })
        spanStart = null
      }
      wasUp = isUp
    }

    previous = time
    if (time.getTime() >= endMs) break
  }

  if (spanStart !== null) {
    spans.push({
      start: spanStart,
      end: at(window.end),
      openStart,
      openEnd: true,
    })
  }

  return spans
}

/** First instant after `before` on the other side of the horizon, to the second. */
function refineCrossing(
  before: Date,
  after: Date,
  wasUp: boolean,
  clearanceAt: (time: Date) => number,
): Date {
  let low = before.getTime()
  let high = after.getTime()

  while (high - low > REFINE_MS) {
    const mid = Math.floor((low + high) / 2)
    if (clearanceAt(new Date(mid)) >= 0 === wasUp) {
      low = mid
    } else {
      high = mid
    }
  }

  return new Date(high)
}
