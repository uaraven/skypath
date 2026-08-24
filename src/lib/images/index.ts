/**
 * Third-party sky imagery. Only view-parameter building lives here — the
 * app never loads an Aladin instance itself; the component does.
 */

export {
  aladinViewParams,
  fieldOfViewDegrees,
  DEFAULT_FIELD_ARCMIN,
  DEFAULT_SURVEY,
  FRAMING_FACTOR,
  MIN_FIELD_DEGREES,
  MAX_FIELD_DEGREES,
  type AladinOptions,
  type AladinViewParams,
} from './aladin'
