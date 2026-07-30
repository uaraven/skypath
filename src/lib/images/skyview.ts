/**
 * URLs for NASA SkyView cutouts — a survey image of the patch of sky a
 * deep-sky object sits in.
 *
 * Pure string building, deliberately kept out of the component: the panel
 * decides *whether* there is an image, this decides *which* one, and the
 * component only ever sees a `src`.
 *
 * The service answers `<img src>` directly (`200 image/gif`, no redirect or
 * poll step) but sends **no `Access-Control-Allow-Origin`** — so the image
 * element is the only way to load it without a proxy, which would mean a
 * backend. Never `fetch` these, and never put `crossorigin` on the `<img>`.
 */

import type { DeepSkyObject } from '../astro/types'

const ENDPOINT = 'https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl'

/** Hours of right ascension to degrees — SkyView's `position` wants degrees. */
const DEGREES_PER_HOUR = 15

/** The spec's fallback field for an object the catalog gives no size for. */
export const DEFAULT_FIELD_ARCMIN = 30

/**
 * How much bigger than the object the frame is. Framing it exactly would run
 * the object edge to edge with no sky around it to place it against.
 */
export const FRAMING_FACTOR = 1.5

/**
 * Load-bearing in both directions: NGC/IC hold degree-scale objects whose
 * cutouts get slow and unreadable past a few degrees, and below ~0.1° a DSS
 * plate is just grain.
 */
export const MIN_FIELD_DEGREES = 0.1
export const MAX_FIELD_DEGREES = 5

export interface SkyViewOptions {
  /** SkyView survey name; `dss2r` is the red DSS2 plate set, covering most sky. */
  survey?: string
  /** Output size in pixels, square. */
  pixels?: number
  /** Field of view in degrees; otherwise derived from the object's size. */
  fieldDegrees?: number
}

const DEFAULTS: Required<Omit<SkyViewOptions, 'fieldDegrees'>> = {
  survey: 'dss2r',
  pixels: 300,
}

/**
 * The field of view to request for an object of this apparent size (major
 * axis, arcminutes), in degrees. Sizeless objects get the spec's 30′.
 */
export function skyViewFieldDegrees(sizeArcmin: number | undefined): number {
  const arcmin =
    sizeArcmin && sizeArcmin > 0 ? sizeArcmin : DEFAULT_FIELD_ARCMIN
  const degrees = (arcmin * FRAMING_FACTOR) / 60
  return Math.min(Math.max(degrees, MIN_FIELD_DEGREES), MAX_FIELD_DEGREES)
}

/**
 * A SkyView cutout URL centred on the object's **catalogue** position.
 *
 * J2000 throughout: the catalogue coordinates are J2000 and so is the survey,
 * so the apparent, precessed-to-date position an observer would point a scope
 * at is exactly the wrong thing to send here.
 */
export function skyViewUrl(
  object: DeepSkyObject,
  options: SkyViewOptions = {},
): string {
  const { survey, pixels } = { ...DEFAULTS, ...options }
  const field = options.fieldDegrees ?? skyViewFieldDegrees(object.size)

  const params = new URLSearchParams({
    Survey: survey,
    position: `${object.ra * DEGREES_PER_HOUR},${object.dec}`,
    coordinates: 'J2000',
    Return: 'GIF',
    size: String(round(field, 4)),
    pixels: String(Math.round(pixels)),
  })

  return `${ENDPOINT}?${params}`
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}
