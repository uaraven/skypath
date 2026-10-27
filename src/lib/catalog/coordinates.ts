/**
 * Targets given as bare coordinates rather than a catalogue name: the user
 * types `RA 05 35 17.3 DEC -05 23 28` into the search box and gets a deep-sky
 * target at that J2000 position.
 *
 * The target's id encodes the coordinates (`RADEC:<ra hours>,<dec degrees>`),
 * so the session store can persist and restore it the same way it does a
 * catalogue id — `coordinateObjectById` is the inverse.
 */

import { formatDec, formatRa } from '../astro/coordinates'
import type { DeepSkyObject } from '../astro/types'

const ID_PREFIX = 'RADEC:'

const INTEGER = /^\d+$/
const DECIMAL = /^\d+(?:\.\d+)?$/

/** Hours (or degrees), minutes, seconds → a decimal value, or null if invalid. */
function sexagesimal(
  fields: string[],
  max: number,
  signed: boolean,
): number | null {
  if (fields.length !== 3) return null
  const [first, minutes, seconds] = fields
  const negative = signed && first.startsWith('-')
  const whole = signed ? first.replace(/^[+-]/, '') : first
  if (!INTEGER.test(whole) || !INTEGER.test(minutes)) return null
  if (!DECIMAL.test(seconds)) return null

  const m = Number(minutes)
  const s = Number(seconds)
  if (m >= 60 || s >= 60) return null

  const value = Number(whole) + m / 60 + s / 3600
  if (value > max) return null
  // The sign belongs to the whole value, so `-00 30 00` is -0.5°, not +0.5°.
  return negative ? -value : value
}

/** Splits `05h 35m 17.3s`, `05:35:17.3` and `05 35 17.3` alike into fields. */
function fieldsOf(text: string): string[] {
  return text
    .replace(/[hmsd:°'′"″]/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter((field) => field !== '')
}

/**
 * Reads `RA <h m s> DEC <d m s>` (keywords case-insensitive, seconds optionally
 * fractional, declination optionally signed). Returns J2000 right ascension in
 * hours and declination in degrees, or null for anything that isn't a
 * well-formed, in-range coordinate pair — so ordinary catalogue queries fall
 * through untouched.
 */
export function parseCoordinateQuery(
  text: string,
): { ra: number; dec: number } | null {
  const match = /^\s*ra\b[\s:=]*(.*?)\s*\bdec\b[\s:=]*(.*)$/i.exec(text)
  if (!match) return null

  const ra = sexagesimal(fieldsOf(match[1]), 24, false)
  const dec = sexagesimal(fieldsOf(match[2]), 90, true)
  if (ra === null || dec === null || ra >= 24) return null
  return { ra, dec }
}

/** A deep-sky target at the given J2000 position (hours, degrees). */
export function coordinateObject(ra: number, dec: number): DeepSkyObject {
  return {
    id: `${ID_PREFIX}${ra.toFixed(6)},${dec.toFixed(6)}`,
    name: `RA ${formatRa(ra)}  Dec ${formatDec(dec)}`,
    kind: 'deep-sky',
    ra,
    dec,
  }
}

/** Rebuilds a target from its id, or undefined if `id` isn't one. */
export function coordinateObjectById(id: string): DeepSkyObject | undefined {
  if (!id.startsWith(ID_PREFIX)) return undefined
  const [ra, dec] = id.slice(ID_PREFIX.length).split(',').map(Number)
  if (
    ra === undefined ||
    dec === undefined ||
    !Number.isFinite(ra) ||
    !Number.isFinite(dec) ||
    ra < 0 ||
    ra >= 24 ||
    Math.abs(dec) > 90
  ) {
    return undefined
  }
  return coordinateObject(ra, dec)
}
