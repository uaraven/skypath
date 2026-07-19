/**
 * Sky shading for the charts: the window split into contiguous spans of
 * daylight, the three twilights, and full night.
 *
 * Boundaries are found by sampling the sun's altitude and bisecting where the
 * phase changes, rather than by assembling `computeSunEvents`' individual
 * crossings. The events there are each independently nullable — at high
 * latitudes a night can have a nautical dusk but no astronomical one, and the
 * combinations multiply. Scanning the altitude gives one code path that covers
 * polar day, polar night and everything between, and it cannot produce a gap.
 */

import { sunAltitude } from '../astro/sun'
import { MS_PER_MINUTE } from '../astro/time'
import type { GeoLocation, TimeWindow } from '../astro/types'

export type SkyPhase = 'day' | 'civil' | 'nautical' | 'astronomical' | 'night'

/**
 * Lower altitude bound of each phase, in degrees of *geometric* sun altitude —
 * the convention the twilight definitions are stated in, and what
 * `sunAltitude` reports by default.
 *
 * The day/civil boundary is −0.833° rather than 0°: that is the geometric
 * altitude of the sun's centre when its upper limb touches the horizon, so the
 * band edge lands on the same instant as the sunset reported by
 * `computeSunEvents` (which searches on the apparent limb).
 */
export const PHASE_FLOOR: Record<SkyPhase, number> = {
  day: -0.833,
  civil: -6,
  nautical: -12,
  astronomical: -18,
  night: -Infinity,
}

/** Lightest first — the order the floors must be tested in. */
export const PHASES: readonly SkyPhase[] = [
  'day',
  'civil',
  'nautical',
  'astronomical',
  'night',
]

/** One contiguous span of a single phase. */
export interface SkyBand {
  phase: SkyPhase
  start: Date
  end: Date
}

/**
 * Sampling step. The sun descends at most ~0.25°/minute (at the equator), so
 * two minutes moves it well under the 6° width of a twilight band and no phase
 * can be stepped over entirely.
 */
const SAMPLE_MINUTES = 2

/** Boundary times are refined to the second; finer would not survive display. */
const REFINE_MS = 1000

export function phaseAt(sunAltitudeDegrees: number): SkyPhase {
  return (
    PHASES.find((phase) => sunAltitudeDegrees >= PHASE_FLOOR[phase]) ?? 'night'
  )
}

/**
 * The window divided into phase bands, in order and without gaps: the first
 * band starts at `window.start`, the last ends at `window.end`.
 *
 * Polar day and polar night come out as a single band, which is the right
 * answer rather than a special case.
 */
export function skyBands(
  window: TimeWindow,
  location: GeoLocation,
  sampleMinutes: number = SAMPLE_MINUTES,
): SkyBand[] {
  const step = sampleMinutes * MS_PER_MINUTE
  const startMs = window.start.getTime()
  const endMs = window.end.getTime()

  const phaseOf = (time: Date) => phaseAt(sunAltitude(time, location))

  const bands: SkyBand[] = []
  let bandStart = window.start
  let bandPhase = phaseOf(window.start)
  let previous = window.start

  for (let ms = startMs + step; ms <= endMs + step; ms += step) {
    const time = new Date(Math.min(ms, endMs))
    const phase = phaseOf(time)

    if (phase !== bandPhase) {
      const boundary = refineBoundary(previous, time, bandPhase, phaseOf)
      bands.push({ phase: bandPhase, start: bandStart, end: boundary })
      bandStart = boundary
      bandPhase = phase
    }

    previous = time
    if (time.getTime() >= endMs) break
  }

  bands.push({ phase: bandPhase, start: bandStart, end: window.end })
  return bands
}

/**
 * First instant after `before` that is no longer in `phase`, to the second.
 *
 * Bisecting on phase equality rather than on a specific altitude threshold
 * means the caller never has to know *which* boundary was crossed — including
 * the case where a fast-moving sun crosses two in one sample step.
 */
function refineBoundary(
  before: Date,
  after: Date,
  phase: SkyPhase,
  phaseOf: (time: Date) => SkyPhase,
): Date {
  let low = before.getTime()
  let high = after.getTime()

  while (high - low > REFINE_MS) {
    const mid = Math.floor((low + high) / 2)
    if (phaseOf(new Date(mid)) === phase) {
      low = mid
    } else {
      high = mid
    }
  }

  return new Date(high)
}
