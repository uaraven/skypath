/**
 * Projection for the all-sky chart: the dome seen from below, looking up.
 *
 * The observer lies on their back at the centre of the dial. Zenith is the
 * centre, the rim is the mathematical horizon, north is up and azimuth runs
 * *clockwise* — the "down-top" convention of the reference rendering, and the
 * one a planisphere held overhead shows. That clockwise sense is why east ends
 * up on the right despite the view being from below: we are looking at the sky,
 * not down at a map.
 *
 * Pure geometry over an SVG user-space box, like `scales.ts`: no Svelte, no
 * astronomy.
 */

import { clamp, MAX_ALTITUDE, type Point } from './scales'

/** The circular drawing area, in SVG user units. */
export interface PolarDial {
  cx: number
  cy: number
  /** Radius of the 0° altitude rim. */
  radius: number
}

/**
 * Distance from the centre for an altitude.
 *
 * Linear in altitude: zenith at the centre, horizon at the rim. Altitudes are
 * clamped, so a point below the horizon lands *on* the rim rather than outside
 * the dial — callers that must not draw those (the trajectory) split their
 * curve at the crossing instead of relying on the clamp.
 */
export function altitudeRadius(altitude: number, dial: PolarDial): number {
  const fraction = clamp(altitude, 0, MAX_ALTITUDE) / MAX_ALTITUDE
  return (1 - fraction) * dial.radius
}

/** A sky direction as a point on the dial. */
export function polarPoint(
  azimuth: number,
  altitude: number,
  dial: PolarDial,
): Point {
  return radialPoint(azimuth, altitudeRadius(altitude, dial), dial)
}

/** A point at an arbitrary radius along an azimuth — used for labels and spokes. */
export function radialPoint(
  azimuth: number,
  radius: number,
  dial: PolarDial,
): Point {
  const angle = (azimuth * Math.PI) / 180
  return {
    x: dial.cx + radius * Math.sin(angle),
    y: dial.cy - radius * Math.cos(angle),
  }
}

/** Altitude circles to draw, excluding the rim itself (that is the frame). */
export function ringAltitudes(step: number = 15): number[] {
  const rings: number[] = []
  for (let altitude = step; altitude < MAX_ALTITUDE; altitude += step) {
    rings.push(altitude)
  }
  return rings
}

/** Azimuths of the radial spokes, 0 (north) first. */
export function spokeAzimuths(step: number = 45): number[] {
  const spokes: number[] = []
  for (let azimuth = 0; azimuth < 360; azimuth += step) {
    spokes.push(azimuth)
  }
  return spokes
}

/** `N`/`E`/`S`/`W` at the cardinals, the bearing in degrees elsewhere. */
export function azimuthLabel(azimuth: number): string {
  const cardinals: Record<number, string> = {
    0: 'N',
    90: 'E',
    180: 'S',
    270: 'W',
  }
  return cardinals[azimuth] ?? String(azimuth)
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/** The eight-point compass name for a bearing — for prose, not for the dial. */
export function compassPoint(azimuth: number): string {
  const sector =
    Math.round((((azimuth % 360) + 360) % 360) / 45) % COMPASS.length
  return COMPASS[sector]
}

/** A closed polygon through the points, as an SVG path `d`. */
export function closedPath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return [
    `M${round(first.x)} ${round(first.y)}`,
    ...rest.map((p) => `L${round(p.x)} ${round(p.y)}`),
    'Z',
  ].join(' ')
}

/**
 * The obstructed sky: everything between the rim and the horizon profile.
 *
 * Drawn as the full disc with the clear sky punched out of it, which needs
 * `fill-rule="evenodd"` on the path. Filling the *obstructed* side rather than
 * the clear one is what makes a high tree line read as a thick wall around the
 * edge of the dial, the way the reference rendering shows it.
 */
export function obstructionPath(
  clearSky: readonly Point[],
  dial: PolarDial,
): string {
  if (clearSky.length === 0) return ''
  const { cx, cy, radius } = dial
  const disc = [
    `M${round(cx)} ${round(cy - radius)}`,
    `A${radius} ${radius} 0 1 1 ${round(cx)} ${round(cy + radius)}`,
    `A${radius} ${radius} 0 1 1 ${round(cx)} ${round(cy - radius)}`,
    'Z',
  ].join(' ')
  return `${disc} ${closedPath(clearSky)}`
}

/** Two decimals is well under a device pixel and keeps the markup readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}
