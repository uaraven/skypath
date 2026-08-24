/**
 * View parameters for an Aladin Lite cutout — the patch of sky a deep-sky
 * object sits in.
 *
 * Pure computation, deliberately kept out of the component: the panel
 * decides *whether* there is a sky view, this decides *where it points and
 * how wide*, and the component only ever sees a target/fov/survey triple.
 */

import type { DeepSkyObject } from '../astro/types'

/** Hours of right ascension to degrees — Aladin's decimal-frame target wants degrees. */
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

/** Aladin's own default HiPS survey. */
export const DEFAULT_SURVEY = 'P/DSS2/color'

export interface AladinOptions {
  /** HiPS survey id; defaults to DSS2 color. */
  survey?: string
  /** Field of view in degrees; otherwise derived from the object's size. */
  fieldDegrees?: number
}

export interface AladinViewParams {
  /** "RA Dec" in decimal degrees (Aladin's ICRSd frame). */
  target: string
  /** Field of view, in degrees. */
  fov: number
  /** HiPS survey id. */
  survey: string
}

/**
 * The field of view to request for an object of this apparent size (major
 * axis, arcminutes), in degrees. Sizeless objects get the spec's 30′.
 */
export function fieldOfViewDegrees(sizeArcmin: number | undefined): number {
  const arcmin =
    sizeArcmin && sizeArcmin > 0 ? sizeArcmin : DEFAULT_FIELD_ARCMIN
  const degrees = (arcmin * FRAMING_FACTOR) / 60
  return Math.min(Math.max(degrees, MIN_FIELD_DEGREES), MAX_FIELD_DEGREES)
}

/**
 * Aladin view parameters centred on the object's **catalogue** position.
 *
 * J2000 throughout: the catalogue coordinates are J2000 and so is the
 * survey, so the apparent, precessed-to-date position an observer would
 * point a scope at is exactly the wrong thing to send here.
 */
export function aladinViewParams(
  object: DeepSkyObject,
  options: AladinOptions = {},
): AladinViewParams {
  const survey = options.survey ?? DEFAULT_SURVEY
  const fov = options.fieldDegrees ?? fieldOfViewDegrees(object.size)

  return {
    target: `${object.ra * DEGREES_PER_HOUR} ${object.dec}`,
    fov,
    survey,
  }
}
