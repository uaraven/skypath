import { isDeepSky, type DeepSkyObject, type SkyObject } from '../astro/types'
import type { Designation } from './catalogs'

/**
 * A deep-sky object as the catalog layer knows it: the coordinates the
 * astronomy layer needs, plus every designation and common name it goes by.
 *
 * An object routinely belongs to several catalogs (M 42 = NGC 1976) and
 * carries several common names ("Orion Nebula", "Great Orion Nebula"), so
 * both are lists. `designations[0]` and `names[0]` are the primary ones —
 * designations are ordered by the `CATALOGS` registry, names as the source
 * lists them.
 */
export interface CatalogObject extends DeepSkyObject {
  designations: Designation[]
  names: string[]
  /** IAU three-letter abbreviation, e.g. `Ori`. */
  constellation?: string
}

/**
 * Distinguishes a catalog object from a bare `DeepSkyObject` (which tests and
 * ad-hoc callers may construct with just coordinates).
 */
export function isCatalogObject(object: SkyObject): object is CatalogObject {
  return isDeepSky(object) && 'designations' in object
}

/**
 * The on-disk shape of a data file under `data/`. Any importer for a catalog
 * OpenNGC does not carry must emit this; see `scripts/build-catalog.mjs`.
 *
 * Designations are written as plain strings (`"NGC1952"`) and parsed on load,
 * which keeps the files readable and diffable.
 */
export interface CatalogFile {
  /** Id of the catalog this file enumerates, e.g. `M`. */
  catalog: string
  title: string
  /** Attribution for the data, shown in the about/credits text. */
  source: string
  objects: CatalogFileEntry[]
}

export interface CatalogFileEntry {
  id: string
  designations: string[]
  names: string[]
  /** Right ascension in hours (0–24), J2000. */
  ra: number
  /** Declination in degrees, J2000. */
  dec: number
  type?: string
  magnitude?: number
  constellation?: string
}
