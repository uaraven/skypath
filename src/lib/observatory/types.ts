import type { GeoLocation } from '../astro/types'

/**
 * A named observing site: where the observer is, and what the sky looks like
 * from there.
 *
 * The horizon is kept as the **raw NINA text the user supplied**, not as parsed
 * points. That way an imported file survives a round trip through localStorage
 * byte for byte, comments and all, and the user can re-edit exactly what they
 * pasted. Parsing happens on the way to the charts, via `horizonFromText`.
 */
export interface Observatory {
  id: string
  name: string
  /** Degrees north, -90…90. */
  latitude: number
  /** Degrees east, -180…180. */
  longitude: number
  /** Metres above sea level; optional, only refines refraction slightly. */
  elevation?: number
  /** NINA horizon file contents; empty means a flat 0° horizon. */
  horizonText: string
}

/** The fields the user fills in; the store assigns the id. */
export type ObservatoryInput = Omit<Observatory, 'id'>

export const LATITUDE_RANGE = { min: -90, max: 90 } as const
export const LONGITUDE_RANGE = { min: -180, max: 180 } as const

/** Extracts what the astronomy layer needs from an observatory. */
export function observatoryLocation(observatory: Observatory): GeoLocation {
  return {
    latitude: observatory.latitude,
    longitude: observatory.longitude,
    elevation: observatory.elevation,
  }
}

/**
 * Structural check used when reading localStorage, where the data may be from
 * an older build, a different app, or a user poking at devtools.
 */
export function isObservatory(value: unknown): value is Observatory {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Observatory>
  return (
    typeof candidate.id === 'string' &&
    candidate.id !== '' &&
    typeof candidate.name === 'string' &&
    inRange(candidate.latitude, LATITUDE_RANGE) &&
    inRange(candidate.longitude, LONGITUDE_RANGE) &&
    typeof candidate.horizonText === 'string' &&
    (candidate.elevation === undefined || Number.isFinite(candidate.elevation))
  )
}

function inRange(
  value: unknown,
  range: { min: number; max: number },
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= range.min &&
    value <= range.max
  )
}
