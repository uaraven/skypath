/**
 * The catalog of observable targets: bundled deep-sky objects plus the solar
 * system bodies astronomy-engine computes directly.
 *
 * This is the module the UI talks to — `searchObjects` for the picker,
 * `objectById` for restoring a saved selection.
 */

import type { SkyObject } from '../astro/types'
import { designationKey, parseDesignation } from './catalogs'
import { deepSkyObjects } from './dso'
import { SearchIndex, type SearchResult } from './search'
import { solarSystemObjects } from './solar-system'
import type { CatalogObject } from './types'

export { deepSkyObjects, catalogSources } from './dso'
export { solarSystemObjects, PLANETS, MOON } from './solar-system'
export { SearchIndex, normalize, type SearchResult } from './search'
export { buildCatalog } from './dso'
export {
  CATALOGS,
  catalogById,
  formatDesignation,
  parseDesignation,
  designationKey,
  typeLabel,
  OBJECT_TYPES,
  type CatalogDefinition,
  type Designation,
} from './catalogs'
export {
  isCatalogObject,
  type CatalogObject,
  type CatalogFile,
  type CatalogFileEntry,
} from './types'

/**
 * Solar system first: there are only eight of them and they are what a user
 * scrolling an unfiltered list is most likely to want.
 */
export const allObjects: SkyObject[] = [
  ...solarSystemObjects,
  ...deepSkyObjects,
]

const index = new SearchIndex(allObjects)

const byId = new Map(allObjects.map((object) => [object.id, object]))

/** Ranked matches for a free-text query; empty for an empty query. */
export function searchObjects(query: string, limit?: number): SearchResult[] {
  return index.search(query, limit)
}

/** Looks up an object by its stable id, e.g. `M13` or `jupiter`. */
export function objectById(id: string): SkyObject | undefined {
  return byId.get(id)
}

const byDesignation = new Map(
  deepSkyObjects.flatMap((object) =>
    object.designations.map(
      (designation) => [designationKey(designation), object] as const,
    ),
  ),
)

/**
 * Looks up an object by any of its designations, in any spelling —
 * `NGC 6205`, `ngc6205` and `M13` all reach the same object.
 */
export function objectByDesignation(text: string): CatalogObject | undefined {
  const designation = parseDesignation(text)
  return designation
    ? byDesignation.get(designationKey(designation))
    : undefined
}
