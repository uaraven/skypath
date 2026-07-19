/**
 * Moonrise, moonset and the moon's phase for a night.
 *
 * The Moon belongs on the times panel even though its trajectory is Phase 8:
 * how much moonlight there will be, and when, decides whether a faint target
 * is worth pointing at.
 *
 * Rise and set go through `SearchRiseSet`, which accounts for the Moon's
 * semidiameter and its topocentric parallax — together worth about a degree,
 * which is several minutes of moonrise. Comparing a geocentric centre altitude
 * against 0° would disagree with every almanac.
 */

import { Body, Illumination, MoonPhase, SearchRiseSet } from 'astronomy-engine'
import { horizontalAt, toObserver } from './ephemeris'
import { windowHours } from './time'
import type {
  GeoLocation,
  SolarSystemObject,
  TimeWindow,
  TrajectoryPoint,
} from './types'

/**
 * The Moon as an observing target.
 *
 * It lives here rather than in the catalog for the same reason `SUN` lives in
 * `sun.ts`: this module needs it, and `astro/` must not import from
 * `catalog/`. The catalog re-exports it so it is still searchable.
 */
export const MOON: SolarSystemObject = {
  id: 'moon',
  name: 'Moon',
  kind: 'moon',
  body: Body.Moon,
}

/** The eight conventional names for the lunar cycle. */
export type MoonPhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent'

/** Names in cycle order, each covering a 45°-wide bin of phase angle. */
const PHASE_NAMES: readonly MoonPhaseName[] = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
]

export interface MoonEvents {
  window: TimeWindow
  rise: TrajectoryPoint | null
  set: TrajectoryPoint | null
  /**
   * Ecliptic elongation from the sun in degrees, 0–360: 0 is new, 90 first
   * quarter, 180 full, 270 last quarter. Taken at local midnight — the middle
   * of the night, and the phase moves only ~6° across a whole window.
   */
  phaseAngle: number
  /** Illuminated fraction of the disc, 0–1, also at local midnight. */
  illumination: number
  phaseName: MoonPhaseName
}

export function computeMoonEvents(
  window: TimeWindow,
  location: GeoLocation,
): MoonEvents {
  const observer = toObserver(location)
  const limitDays = windowHours(window) / 24

  const search = (direction: 1 | -1): TrajectoryPoint | null => {
    const found = SearchRiseSet(
      Body.Moon,
      observer,
      direction,
      window.start,
      limitDays,
    )
    if (!found) return null
    return { time: found.date, ...horizontalAt(MOON, found.date, location) }
  }

  const phaseAngle = MoonPhase(window.midnight)

  return {
    window,
    rise: search(1),
    set: search(-1),
    phaseAngle,
    illumination: Illumination(Body.Moon, window.midnight).phase_fraction,
    phaseName: moonPhaseName(phaseAngle),
  }
}

/**
 * The bin a phase angle falls in.
 *
 * The four named instants — new, quarters, full — are single moments, so the
 * bins are centred on them rather than starting there: anything within 22.5°
 * of full reads as "Full Moon", which is how the phase is spoken about.
 */
export function moonPhaseName(phaseAngle: number): MoonPhaseName {
  const bin = Math.floor(((((phaseAngle + 22.5) % 360) + 360) % 360) / 45)
  return PHASE_NAMES[bin]
}
