import { Body } from 'astronomy-engine'

/** Observer position on Earth. Elevation is metres above sea level. */
export interface GeoLocation {
  latitude: number
  longitude: number
  elevation?: number
}

/**
 * A solar-system body we can ask astronomy-engine about directly.
 * `body` is anything with a built-in ephemeris (Sun, Moon, Mercury…Neptune).
 */
export interface SolarSystemObject {
  id: string
  name: string
  kind: 'sun' | 'moon' | 'planet'
  body: Body
}

/**
 * A fixed object catalogued by J2000 equatorial coordinates — Messier objects
 * and anything else far enough away that proper motion is irrelevant here.
 *
 * `ra` is in **hours** (0–24), matching astronomy-engine's convention;
 * `dec` is in degrees.
 */
export interface DeepSkyObject {
  id: string
  name: string
  kind: 'deep-sky'
  ra: number
  dec: number
  type?: string
  magnitude?: number
  /** Apparent major axis in arcminutes, where the catalog records one. */
  size?: number
}

export type SkyObject = SolarSystemObject | DeepSkyObject

export function isDeepSky(object: SkyObject): object is DeepSkyObject {
  return object.kind === 'deep-sky'
}

/** Apparent position in the observer's sky. Both in degrees. */
export interface HorizontalPos {
  /** Degrees above the horizon; negative below. */
  altitude: number
  /** Degrees clockwise from north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuth: number
}

export interface TrajectoryPoint extends HorizontalPos {
  time: Date
}

/**
 * The span a chart covers: local noon on the chosen date through local noon
 * the next day, so the night sits contiguously in the middle.
 */
export interface TimeWindow {
  start: Date
  end: Date
  /** Local midnight, i.e. the centre of the window. */
  midnight: Date
}
