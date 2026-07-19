import { isDeepSky, type SkyObject } from '../astro/types'
import {
  designationKey,
  parseDesignation,
  typeLabel,
  type Designation,
} from './catalogs'
import { isCatalogObject } from './types'

/**
 * Free-text search over the catalog.
 *
 * A query is matched three ways, and an object scores the best match it gets:
 * as a designation (`m13`, `M 13`, `ngc6205`), as a common name (`orion`), or
 * as a bare number matching any of the object's catalog numbers (`6205`).
 * Object type ("globular", "galaxy") matches too, but ranks below everything
 * else so typing a name never buries the object you meant under its kind.
 */

const SCORE = {
  designationExact: 100,
  nameExact: 90,
  namePrefix: 80,
  numberExact: 70,
  nameWordPrefix: 65,
  nameSubstring: 60,
  designationPrefix: 50,
  type: 20,
} as const

export interface SearchResult {
  object: SkyObject
  score: number
}

interface IndexEntry {
  object: SkyObject
  /** `m13`, `ngc6205` — exact designation keys. */
  designations: Set<string>
  /** Catalog numbers on their own, for bare-number queries. */
  numbers: Set<string>
  /** Normalized common names plus the display name. */
  names: string[]
  /** Normalized type label, if any. */
  type?: string
}

/**
 * Normalizes text for comparison: lower case, accents stripped, punctuation
 * collapsed to single spaces. `"Ptolemy's Cluster"` → `"ptolemy s cluster"`,
 * so both `ptolemy` and `cluster` match at a word boundary.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function indexEntry(object: SkyObject): IndexEntry {
  const names = [object.name]
  let designations: Designation[] = []
  let type: string | undefined

  if (isCatalogObject(object)) {
    designations = object.designations
    names.push(...object.names)
    type = typeLabel(object.type)
  }

  return {
    object,
    designations: new Set(designations.map(designationKey)),
    numbers: new Set(designations.map((designation) => designation.number)),
    names: [...new Set(names.map(normalize))].filter(Boolean),
    type: type ? normalize(type) : undefined,
  }
}

export class SearchIndex {
  private readonly entries: IndexEntry[]

  constructor(objects: SkyObject[]) {
    this.entries = objects.map(indexEntry)
  }

  search(query: string, limit = 20): SearchResult[] {
    const normalized = normalize(query)
    if (!normalized) return []

    // Both spellings matter: "m 13" is what normalize() produces, "m13" is
    // what designation keys look like.
    const compact = normalized.replace(/ /g, '')
    const designation = parseDesignation(compact)

    const results: SearchResult[] = []
    for (const entry of this.entries) {
      const score = scoreEntry(entry, normalized, compact, designation)
      if (score > 0) results.push({ object: entry.object, score })
    }

    results.sort(
      (a, b) => b.score - a.score || byBrightness(a.object, b.object),
    )
    return results.slice(0, limit)
  }
}

function scoreEntry(
  entry: IndexEntry,
  query: string,
  compact: string,
  designation: Designation | null,
): number {
  let score = 0

  if (designation) {
    const key = designationKey(designation)
    if (entry.designations.has(key)) {
      score = Math.max(score, SCORE.designationExact)
    } else if ([...entry.designations].some((k) => k.startsWith(key))) {
      score = Math.max(score, SCORE.designationPrefix)
    }
  }

  if (/^\d+$/.test(compact) && entry.numbers.has(compact)) {
    score = Math.max(score, SCORE.numberExact)
  }

  for (const name of entry.names) {
    score = Math.max(score, scoreName(name, query))
  }

  if (entry.type?.includes(query)) {
    score = Math.max(score, SCORE.type)
  }

  return score
}

function scoreName(name: string, query: string): number {
  if (name === query) return SCORE.nameExact
  if (name.startsWith(query)) return SCORE.namePrefix
  if (name.includes(` ${query}`)) return SCORE.nameWordPrefix
  if (name.includes(query)) return SCORE.nameSubstring
  return 0
}

/**
 * Tie-break: the brighter object first, since equally-good matches are
 * usually a user reaching for the well-known one. Objects with no recorded
 * magnitude sort last.
 */
function byBrightness(a: SkyObject, b: SkyObject): number {
  const magA = isDeepSky(a) ? (a.magnitude ?? Infinity) : -Infinity
  const magB = isDeepSky(b) ? (b.magnitude ?? Infinity) : -Infinity
  return magA - magB
}
