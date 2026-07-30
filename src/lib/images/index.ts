/**
 * Third-party sky imagery. Only URL building lives here — the app never
 * fetches these bytes itself; an `<img>` does.
 */

export {
  skyViewUrl,
  skyViewFieldDegrees,
  DEFAULT_FIELD_ARCMIN,
  FRAMING_FACTOR,
  MIN_FIELD_DEGREES,
  MAX_FIELD_DEGREES,
  type SkyViewOptions,
} from './skyview'
