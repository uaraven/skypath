/**
 * Where the object is at an arbitrary instant on an already-sampled track.
 *
 * The time slider moves continuously while a trajectory is sampled every few
 * minutes, and asking the ephemeris again on every drag frame would rebuild
 * the whole model — including the twilight scan — for each pixel of travel.
 * Interpolating instead has a second, better reason: the indicator promises to
 * sit *on the drawn line*, and the drawn line is these samples joined up. A
 * freshly computed position would be marginally truer to the sky and visibly
 * off the curve near a steep passage.
 *
 * Pure geometry over the samples, like the rest of this directory: no Svelte,
 * no astronomy.
 */

import type { TrajectoryPoint } from '../astro/types'
import { normalizeAzimuth } from '../horizon'

/**
 * The interpolated position at `time`, or null if it falls outside the track.
 *
 * Outside rather than clamped: a marker pinned to the end of the curve would
 * claim the object is there at a time it does not cover.
 */
export function trajectoryAt(
  points: readonly TrajectoryPoint[],
  time: Date,
): TrajectoryPoint | null {
  if (points.length === 0) return null

  const ms = time.getTime()
  if (ms < points[0].time.getTime()) return null
  if (ms > points[points.length - 1].time.getTime()) return null

  const index = segmentStart(points, ms)
  const from = points[index]
  const to = points[index + 1]
  if (!to) return { ...from }

  const span = to.time.getTime() - from.time.getTime()
  const fraction = span === 0 ? 0 : (ms - from.time.getTime()) / span

  return {
    time: new Date(ms),
    altitude: from.altitude + fraction * (to.altitude - from.altitude),
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
export function shortestTurn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

/** Index of the last sample at or before `ms`. Binary search: this runs per frame. */
function segmentStart(points: readonly TrajectoryPoint[], ms: number): number {
  let low = 0
  let high = points.length - 1

  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (points[mid].time.getTime() <= ms) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return low
}

/**
 * A triangle pointing down at `apex`, as an SVG path `d`.
 *
 * The indicator hangs above the point it marks rather than sitting on it, so
 * the curve underneath stays readable where the two meet.
 */
export function markerTriangle(
  apex: { x: number; y: number },
  size: number,
): string {
  const half = size / 2
  const top = apex.y - size
  return [
    `M${round(apex.x)} ${round(apex.y)}`,
    `L${round(apex.x - half)} ${round(top)}`,
    `L${round(apex.x + half)} ${round(top)}`,
    'Z',
  ].join(' ')
}

/** Two decimals is well under a device pixel and keeps the markup readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}
