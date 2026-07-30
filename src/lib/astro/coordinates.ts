/**
 * Equatorial coordinates for display, and their sexagesimal formatting.
 */

import type { FlexibleDateTime } from 'astronomy-engine'
import { equatorOfDate, toObserver } from './ephemeris'
import { isDeepSky, type GeoLocation, type SkyObject } from './types'

/** `ra` is in hours (0–24); `dec` is in degrees. */
export interface EquatorialPosition {
  ra: number
  dec: number
}

/**
 * Coordinates to show for an object.
 *
 * Catalogue objects report their fixed J2000 position — the reference frame
 * they're identified by. Solar-system bodies have no fixed position, so
 * theirs is the of-date position (precessed, with aberration) at `time`.
 */
export function equatorialPosition(
  object: SkyObject,
  time: FlexibleDateTime,
  location: GeoLocation,
): EquatorialPosition {
  if (isDeepSky(object)) return { ra: object.ra, dec: object.dec }
  const eq = equatorOfDate(object, time, toObserver(location))
  return { ra: eq.ra, dec: eq.dec }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** `5.5` → `"05h 30m 00s"`. */
export function formatRa(hours: number): string {
  // Modulo twice: once on the input hours, once more on the rounded seconds
  // — rounding 23.9999997h up to the next second can itself reach 24:00:00.
  const totalSeconds =
    Math.round((((hours % 24) + 24) % 24) * 3600) % (24 * 3600)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`
}

/** `-22.25` → `"-22° 15′ 00″"`. */
export function formatDec(degrees: number): string {
  const sign = degrees < 0 ? '-' : '+'
  const totalArcseconds = Math.round(Math.abs(degrees) * 3600)
  const d = Math.floor(totalArcseconds / 3600)
  const m = Math.floor((totalArcseconds % 3600) / 60)
  const s = totalArcseconds % 60
  return `${sign}${pad(d)}° ${pad(m)}′ ${pad(s)}″`
}

/**
 * Splits a non-negative magnitude (hours or degrees) into whole/minute/second
 * parts, the seconds field carrying `decimals` fractional digits.
 *
 * Rounds once, on the total count of the smallest unit, before dividing back
 * out — rounding each field separately could carry a `59.9996` up to a
 * printed `60.000`.
 */
function sexagesimalParts(
  magnitude: number,
  decimals: number,
  wrapAt?: number,
) {
  const scale = 10 ** decimals
  const totalSecondUnits = Math.round(magnitude * 3600 * scale)
  const secondUnitsPerMinute = 60 * scale
  const secondUnitsPerWhole = 60 * secondUnitsPerMinute

  // Rounding up to the smallest unit can itself carry into the next whole
  // (23.9999997h → 24:00:00.000), so the wrap has to happen after rounding.
  const wrapUnits =
    wrapAt !== undefined ? wrapAt * secondUnitsPerWhole : undefined
  const wrapped =
    wrapUnits !== undefined ? totalSecondUnits % wrapUnits : totalSecondUnits

  const whole = Math.floor(wrapped / secondUnitsPerWhole)
  const remainder = wrapped % secondUnitsPerWhole
  const minute = Math.floor(remainder / secondUnitsPerMinute)
  const second = (remainder % secondUnitsPerMinute) / scale
  return {
    whole,
    minute,
    second: second.toFixed(decimals).padStart(decimals + 3, '0'),
  }
}

/**
 * Coordinates as plain space-separated sexagesimal fields, the format
 * planetarium software (Stellarium, SkySafari, NINA…) expects when pasted
 * into a "go to coordinates" field: no unit symbols, sub-arcsecond precision.
 * RA carries three decimal places on its seconds (a tenth of a time-second is
 * 1.5″ at the equator); dec carries two, since its seconds are already in
 * arcseconds.
 *
 * `20 54 05.689 +37 01 17.38`
 */
export function formatCoordinatesForClipboard(
  position: EquatorialPosition,
): string {
  const ra = sexagesimalParts(((position.ra % 24) + 24) % 24, 3, 24)
  const dec = sexagesimalParts(Math.abs(position.dec), 2)
  const sign = position.dec < 0 ? '-' : '+'

  return (
    `${pad(ra.whole)} ${pad(ra.minute)} ${ra.second} ` +
    `${sign}${pad(dec.whole)} ${pad(dec.minute)} ${dec.second}`
  )
}
