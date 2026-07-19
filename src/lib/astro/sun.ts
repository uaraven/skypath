import { Body, SearchAltitude, SearchRiseSet } from 'astronomy-engine'
import { horizontalAt, toObserver, type AltitudeConvention } from './ephemeris'
import { nightWindow, windowHours } from './time'
import type { GeoLocation, SkyObject, TimeWindow } from './types'

export const SUN: SkyObject = {
  id: 'sun',
  name: 'Sun',
  kind: 'sun',
  body: Body.Sun,
}

/**
 * Sun depression angles defining each twilight phase, in degrees. These are
 * the geometric altitude of the sun's centre, which is what SearchAltitude
 * solves for — matching the standard definitions.
 */
export const TWILIGHT_ALTITUDES = {
  civil: -6,
  nautical: -12,
  astronomical: -18,
} as const

export type TwilightPhase = keyof typeof TWILIGHT_ALTITUDES

/** Evening (dusk) and morning (dawn) crossings of one twilight boundary. */
export interface TwilightPair {
  dusk: Date | null
  dawn: Date | null
}

export interface SunEvents {
  window: TimeWindow
  sunset: Date | null
  sunrise: Date | null
  twilight: Record<TwilightPhase, TwilightPair>
  /** Sun above the horizon for the whole window — no night at all. */
  polarDay: boolean
  /** Sun below the horizon for the whole window — no daylight at all. */
  polarNight: boolean
}

/**
 * Sunset, sunrise and the three twilight pairs across the night starting on
 * `date`.
 *
 * Every search runs forward from local noon, so the first descending crossing
 * is that evening's and the first ascending crossing is the next morning's.
 * A null result means the crossing does not occur within the window, which at
 * high latitudes is a real answer rather than a failure — see `polarDay` /
 * `polarNight`.
 */
export function computeSunEvents(date: Date, location: GeoLocation): SunEvents {
  const window = nightWindow(date)
  const observer = toObserver(location)
  const limitDays = windowHours(window) / 24

  const search = (direction: 1 | -1, altitude?: number): Date | null => {
    const found =
      altitude === undefined
        ? SearchRiseSet(Body.Sun, observer, direction, window.start, limitDays)
        : SearchAltitude(
            Body.Sun,
            observer,
            direction,
            window.start,
            limitDays,
            altitude,
          )
    return found ? found.date : null
  }

  const sunset = search(-1)
  const sunrise = search(1)

  const twilight = {} as Record<TwilightPhase, TwilightPair>
  for (const phase of Object.keys(TWILIGHT_ALTITUDES) as TwilightPhase[]) {
    const altitude = TWILIGHT_ALTITUDES[phase]
    twilight[phase] = { dusk: search(-1, altitude), dawn: search(1, altitude) }
  }

  // With no rise and no set, the sun sits entirely on one side of the horizon;
  // its altitude at midnight says which.
  const neverCrosses = sunset === null && sunrise === null
  const midnightAltitude = horizontalAt(SUN, window.midnight, location).altitude

  return {
    window,
    sunset,
    sunrise,
    twilight,
    polarDay: neverCrosses && midnightAltitude > 0,
    polarNight: neverCrosses && midnightAltitude <= 0,
  }
}

/**
 * Sun altitude in degrees at a given moment — used for chart shading.
 *
 * Twilight boundaries are defined geometrically, so that is the default here;
 * comparing a refracted altitude against −6/−12/−18° would be inconsistent
 * with the dusk and dawn times above.
 */
export function sunAltitude(
  time: Date,
  location: GeoLocation,
  convention: AltitudeConvention = 'geometric',
): number {
  return horizontalAt(SUN, time, location, convention).altitude
}
