/**
 * The registry of designation catalogs and object types.
 *
 * Adding a catalog (NGC, Sharpless 2, Collinder, …) means adding an entry to
 * `CATALOGS` and dropping a data file next to it — nothing else in the catalog
 * layer needs to change. The order of `CATALOGS` is significant: it decides
 * which designation an object is listed under when it belongs to several.
 */

export interface CatalogDefinition {
  /** Prefix used in designation strings and in the data files, e.g. `NGC`. */
  id: string
  /** Full name, for tooltips and attribution. */
  name: string
  /**
   * Separator between prefix and number when a designation is displayed —
   * `M13` but `NGC 6205` and `Sh2-155`, following the usual conventions.
   */
  separator: string
  /**
   * Extra spellings a user might type, normalized (lower case, no
   * punctuation). The `id` itself is always accepted and need not be repeated.
   */
  aliases?: string[]
}

/** Ordered by how a user is most likely to refer to an object. */
export const CATALOGS: CatalogDefinition[] = [
  { id: 'M', name: 'Messier', separator: '', aliases: ['messier'] },
  { id: 'NGC', name: 'New General Catalogue', separator: ' ' },
  { id: 'IC', name: 'Index Catalogue', separator: ' ' },
  { id: 'Mel', name: 'Melotte', separator: ' ', aliases: ['melotte'] },
  { id: 'Cr', name: 'Collinder', separator: ' ', aliases: ['collinder'] },
  {
    id: 'Sh2',
    name: 'Sharpless 2',
    separator: '-',
    aliases: ['sharpless', 'sh'],
  },
  { id: 'LDN', name: 'Lynds Dark Nebula', separator: ' ' },
  { id: 'UGC', name: 'Uppsala General Catalogue', separator: ' ' },
  { id: 'PGC', name: 'Principal Galaxies Catalogue', separator: ' ' },
  { id: 'LBN', name: 'Lynds Bright Nebula', separator: ' ' },
]

const BY_ID = new Map(CATALOGS.map((catalog) => [catalog.id, catalog]))

/**
 * Prefixes accepted when parsing, longest first so that a catalog whose id
 * starts with another's (`Sh2` vs a future `S`) is matched first.
 */
const PREFIXES: { prefix: string; catalog: CatalogDefinition }[] =
  CATALOGS.flatMap((catalog) =>
    [catalog.id, ...(catalog.aliases ?? [])].map((prefix) => ({
      prefix: prefix.toLowerCase(),
      catalog,
    })),
  ).sort((a, b) => b.prefix.length - a.prefix.length)

export function catalogById(id: string): CatalogDefinition | undefined {
  return BY_ID.get(id)
}

export interface Designation {
  catalog: string
  /** Kept as a string: a few catalogs have entries like `4a`. */
  number: string
}

/**
 * Parses `"NGC1952"`, `"NGC 1952"` or `"ngc-1952"` into its catalog and
 * number. Returns null when the prefix is not a registered catalog, which is
 * how unknown identifiers in data files and nonsense queries are rejected.
 */
export function parseDesignation(text: string): Designation | null {
  const normalized = text.trim().toLowerCase()
  for (const { prefix, catalog } of PREFIXES) {
    if (!normalized.startsWith(prefix)) continue
    const rest = normalized.slice(prefix.length).replace(/^[\s-]+/, '')
    if (/^\d+[a-z]?$/.test(rest)) {
      return { catalog: catalog.id, number: stripLeadingZeros(rest) }
    }
  }
  return null
}

function stripLeadingZeros(number: string): string {
  return number.replace(/^0+(?=\d)/, '')
}

/** `{ catalog: 'NGC', number: '6205' }` → `"NGC 6205"`. */
export function formatDesignation(designation: Designation): string {
  const catalog = catalogById(designation.catalog)
  return `${designation.catalog}${catalog?.separator ?? ' '}${designation.number}`
}

/** Case-insensitive key for exact designation lookup and de-duplication. */
export function designationKey(designation: Designation): string {
  return `${designation.catalog.toLowerCase()}${designation.number}`
}

/**
 * Object type codes as used by OpenNGC, mapped to labels we show. Unknown
 * codes fall back to the raw code so a new data source degrades gracefully
 * instead of showing a blank.
 */
export const OBJECT_TYPES: Record<string, string> = {
  '*': 'Star',
  '**': 'Double star',
  '*Ass': 'Star cloud',
  OCl: 'Open cluster',
  GCl: 'Globular cluster',
  'Cl+N': 'Cluster with nebulosity',
  G: 'Galaxy',
  GPair: 'Galaxy pair',
  GTrpl: 'Galaxy triplet',
  GGroup: 'Galaxy group',
  PN: 'Planetary nebula',
  HII: 'HII region',
  DrkN: 'Dark nebula',
  EmN: 'Emission nebula',
  RfN: 'Reflection nebula',
  SNR: 'Supernova remnant',
  Neb: 'Nebula',
  Other: 'Other',
}

export function typeLabel(type: string | undefined): string | undefined {
  if (!type) return undefined
  return OBJECT_TYPES[type] ?? type
}
