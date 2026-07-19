import {
  Body,
  DefineStar,
  Equator,
  Horizon,
  Observer,
  type EquatorialCoordinates,
  type FlexibleDateTime,
} from 'astronomy-engine'
import {
  isDeepSky,
  type GeoLocation,
  type HorizontalPos,
  type SkyObject,
} from './types'

/**
 * Which altitude convention to report.
 *
 * - `apparent` includes atmospheric refraction — where the object actually
 *   looks to be. This matches SearchRiseSet and SearchHourAngle, so a
 *   trajectory drawn this way agrees with the rise/set times beside it.
 * - `geometric` is the true angle, ignoring the atmosphere. This is what
 *   SearchAltitude solves for, and what the twilight definitions (−6/−12/−18°)
 *   are stated in.
 *
 * The two differ by about 0.5° near the horizon and are indistinguishable
 * high up, so mixing them silently would put horizon events minutes off.
 */
export type AltitudeConvention = 'apparent' | 'geometric'

const REFRACTION: Record<AltitudeConvention, string | undefined> = {
  apparent: 'normal',
  geometric: undefined,
}

/**
 * Slot used to hand a catalogue object's J2000 coordinates to
 * astronomy-engine. The library only accepts user-defined stars through eight
 * fixed Body slots, and DefineStar overwrites whatever was there.
 *
 * We redefine the slot immediately before every use rather than caching it,
 * so interleaved calls for different objects can't read each other's
 * coordinates. JS is single-threaded, so nothing can run between the
 * DefineStar and the Equator call below.
 */
const STAR_SLOT = Body.Star1

/** Distance in light years assigned to catalogue objects. */
const CATALOG_DISTANCE_LY = 1000

export function toObserver(location: GeoLocation): Observer {
  return new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  )
}

/**
 * Runs `fn` with an astronomy-engine Body denoting `object`.
 *
 * Catalogue objects have no built-in ephemeris, so they are installed into the
 * shared star slot for the duration of the call. Anything that needs a Body —
 * the rise/set and culmination searches as well as our own coordinate
 * conversion — must go through here, and must not hold on to the Body
 * afterwards: the next call reuses the slot.
 */
export function withEngineBody<T>(object: SkyObject, fn: (body: Body) => T): T {
  if (isDeepSky(object)) {
    DefineStar(STAR_SLOT, object.ra, object.dec, CATALOG_DISTANCE_LY)
    return fn(STAR_SLOT)
  }
  return fn(object.body)
}

/**
 * Equatorial coordinates of date (precessed, with aberration) — the form
 * Horizon() needs. Catalogue coordinates are J2000 and must be precessed;
 * feeding J2000 values straight to Horizon() would misplace an object by
 * roughly a quarter of a degree at present.
 */
function equatorOfDate(
  object: SkyObject,
  time: FlexibleDateTime,
  observer: Observer,
): EquatorialCoordinates {
  return withEngineBody(object, (body) =>
    Equator(body, time, observer, true, true),
  )
}

/**
 * Altitude/azimuth of an object as seen from a location.
 *
 * Defaults to the apparent (refracted) position, which is what an observer
 * sees and what the charts draw.
 */
export function horizontalAt(
  object: SkyObject,
  time: Date,
  location: GeoLocation,
  convention: AltitudeConvention = 'apparent',
): HorizontalPos {
  const observer = toObserver(location)
  const eq = equatorOfDate(object, time, observer)
  const hor = Horizon(time, observer, eq.ra, eq.dec, REFRACTION[convention])
  return { altitude: hor.altitude, azimuth: hor.azimuth }
}
