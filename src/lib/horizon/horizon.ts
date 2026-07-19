/**
 * The observer's local horizon: the altitude obstructions reach, as a function
 * of azimuth.
 *
 * A horizon is a sparse list of measured `(azimuth, altitude)` points that we
 * interpolate linearly between. The azimuth axis is circular, so the segment
 * between the last point and the first wraps through 360°→0° — an object at
 * due north is behind whatever spans the gap from 335° to 5°, not behind
 * nothing.
 */

export interface HorizonPoint {
  /** Degrees clockwise from north, 0–359.999…. */
  azimuth: number
  /** Degrees above the mathematical horizon. */
  altitude: number
}

/** Wraps any azimuth into [0, 360). */
export function normalizeAzimuth(azimuth: number): number {
  return ((azimuth % 360) + 360) % 360
}

export class Horizon {
  /** Measured points, sorted by ascending azimuth. */
  readonly points: readonly HorizonPoint[]

  constructor(points: readonly HorizonPoint[] = []) {
    this.points = [...points].sort((a, b) => a.azimuth - b.azimuth)
  }

  /** True for the default horizon — flat and at 0° everywhere. */
  get isFlat(): boolean {
    return this.points.length === 0
  }

  /**
   * Horizon altitude in the given direction, interpolated between the two
   * surrounding measurements and wrapping across north.
   *
   * An empty horizon is flat at 0°, which is what an observatory with no
   * horizon file gets.
   */
  altitudeAt(azimuth: number): number {
    const points = this.points
    if (points.length === 0) return 0
    if (points.length === 1) return points[0].altitude

    const az = normalizeAzimuth(azimuth)
    const index = this.segmentStart(az)

    // Before the first point or after the last: both fall in the wrap-around
    // segment, which we straighten by lifting its end past 360°.
    if (index === -1 || index === points.length - 1) {
      const from = points[points.length - 1]
      const to = points[0]
      return interpolate(
        az < from.azimuth ? az + 360 : az,
        from.azimuth,
        from.altitude,
        to.azimuth + 360,
        to.altitude,
      )
    }

    const from = points[index]
    const to = points[index + 1]
    return interpolate(az, from.azimuth, from.altitude, to.azimuth, to.altitude)
  }

  /** How far the object clears the horizon; negative when it is blocked. */
  clearance(azimuth: number, altitude: number): number {
    return altitude - this.altitudeAt(azimuth)
  }

  isVisible(azimuth: number, altitude: number): boolean {
    return this.clearance(azimuth, altitude) >= 0
  }

  /** Index of the last point at or before `az`, or -1 if `az` precedes them all. */
  private segmentStart(az: number): number {
    let low = 0
    let high = this.points.length - 1
    let found = -1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (this.points[mid].azimuth <= az) {
        found = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return found
  }
}

/** The horizon used when an observatory has no horizon file: flat at 0°. */
export const FLAT_HORIZON = new Horizon()

function interpolate(
  x: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  if (x1 === x0) return y0
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}
