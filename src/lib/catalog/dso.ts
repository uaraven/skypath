import {
  designationKey,
  formatDesignation,
  parseDesignation,
  type Designation,
} from './catalogs'
import type { CatalogFile, CatalogFileEntry, CatalogObject } from './types'
import messier from './data/messier.json'

/**
 * Data files bundled into the app. To add a catalog, generate its JSON (see
 * `scripts/build-catalog.mjs`), import it here and append it to this list;
 * objects already present under another designation are merged, not duplicated.
 */
const FILES: CatalogFile[] = [messier as CatalogFile]

/**
 * Builds the object list from the given files.
 *
 * Two entries are the same object when they share any designation — that is
 * the only cross-catalog identity we have, and it is the reason designations
 * must be spelled with a registered catalog prefix. On a merge the first
 * file's coordinates win (files are listed most-trusted first) while
 * designations and names are unioned.
 */
export function buildCatalog(files: CatalogFile[]): CatalogObject[] {
  const objects: CatalogObject[] = []
  const byDesignation = new Map<string, CatalogObject>()

  for (const file of files) {
    for (const entry of file.objects) {
      const designations = parseDesignations(entry, file)
      const existing = designations
        .map((designation) => byDesignation.get(designationKey(designation)))
        .find((match) => match !== undefined)

      const object = existing ?? newObject(entry, designations)
      if (existing) {
        mergeInto(existing, entry, designations)
      } else {
        objects.push(object)
      }

      for (const designation of object.designations) {
        byDesignation.set(designationKey(designation), object)
      }
    }
  }

  return objects
}

function parseDesignations(
  entry: CatalogFileEntry,
  file: CatalogFile,
): Designation[] {
  const designations = entry.designations
    .map(parseDesignation)
    .filter((designation): designation is Designation => designation !== null)

  if (designations.length === 0) {
    throw new Error(
      `${file.catalog}: entry ${entry.id} has no parseable designation ` +
        `(${entry.designations.join(', ')}) — is its catalog registered?`,
    )
  }
  return designations
}

function newObject(
  entry: CatalogFileEntry,
  designations: Designation[],
): CatalogObject {
  return {
    id: entry.id,
    name: displayName(entry.names, designations),
    kind: 'deep-sky',
    ra: entry.ra,
    dec: entry.dec,
    type: entry.type,
    magnitude: entry.magnitude,
    constellation: entry.constellation,
    designations,
    names: [...entry.names],
  }
}

function mergeInto(
  object: CatalogObject,
  entry: CatalogFileEntry,
  designations: Designation[],
): void {
  const known = new Set(object.designations.map(designationKey))
  for (const designation of designations) {
    if (!known.has(designationKey(designation))) {
      object.designations.push(designation)
      known.add(designationKey(designation))
    }
  }
  for (const name of entry.names) {
    if (!object.names.includes(name)) object.names.push(name)
  }
  object.type ??= entry.type
  object.magnitude ??= entry.magnitude
  object.constellation ??= entry.constellation
  object.name = displayName(object.names, object.designations)
}

/**
 * What the object is called in a list: its common name where it has one,
 * otherwise its primary designation. Most of the sky has only a number.
 */
function displayName(names: string[], designations: Designation[]): string {
  return names[0] ?? formatDesignation(designations[0])
}

/** Every bundled deep-sky object, in data-file order. */
export const deepSkyObjects: CatalogObject[] = buildCatalog(FILES)

/** Attribution lines for the bundled data, for the credits text. */
export const catalogSources: string[] = [
  ...new Set(FILES.map((file) => file.source)),
]
