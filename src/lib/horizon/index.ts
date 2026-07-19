/**
 * The observer's local horizon: parsing NINA horizon files and looking up the
 * horizon altitude in a given direction.
 *
 * This is the module the rest of the app talks to — `horizonFromText` for the
 * render path, `parseHorizon` for the upload UI, which needs the issue list.
 */

export {
  Horizon,
  FLAT_HORIZON,
  normalizeAzimuth,
  type HorizonPoint,
} from './horizon'
export {
  parseHorizon,
  horizonFromText,
  formatHorizon,
  type HorizonParseResult,
  type HorizonParseIssue,
} from './parser'
