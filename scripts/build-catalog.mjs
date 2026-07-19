#!/usr/bin/env node
/**
 * Regenerates the bundled deep-sky catalog files.
 *
 *   node scripts/build-catalog.mjs
 *
 * Two kinds of source, each with its own section below:
 *
 * - **OpenNGC** (https://github.com/mattiaverga/OpenNGC, CC-BY-SA-4.0) gives
 *   Messier, NGC and IC. Add an OpenNGC-derived catalog by appending to
 *   `OPENNGC_BUILDS`.
 * - **VizieR** (CDS) gives the catalogs OpenNGC does not carry — Sharpless 2
 *   and LDN. Add one by appending to `VIZIER_BUILDS`.
 *
 * Either way the catalog must also be registered in
 * src/lib/catalog/catalogs.ts, the file imported in dso.ts, and the emitted
 * JSON must match `CatalogFile` in src/lib/catalog/types.ts. Source data is
 * downloaded on each run and never kept in the repo; only the generated JSON
 * under src/lib/catalog/data/ is committed.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Constellation } from 'astronomy-engine'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'src/lib/catalog/data')

const BASE_URL =
  'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files'

const SOURCE =
  'OpenNGC (https://github.com/mattiaverga/OpenNGC), CC-BY-SA-4.0, ' +
  'plus the Messier designations of the addendum file.'

/**
 * Catalogs we lift out of the free-form `Identifiers` column. Everything else
 * there is survey-internal (MWSC, SDSS, 2MASX…) and of no use in a picker.
 */
const IDENTIFIER_CATALOGS = ['UGC', 'PGC', 'LBN']

/**
 * Order in which designations are listed on an object; earliest wins as
 * primary. Must agree with `CATALOGS` in src/lib/catalog/catalogs.ts.
 */
const CATALOG_ORDER = [
  'M',
  'NGC',
  'IC',
  'Mel',
  'Cr',
  'Sh2',
  'LDN',
  'UGC',
  'PGC',
  'LBN',
]

/** Longest first, so `Mel20` matches `Mel` rather than `M`. */
const ORDER_PREFIXES = [...CATALOG_ORDER].sort((a, b) => b.length - a.length)

/**
 * Rows where we depart from OpenNGC's own resolution, keyed by its `Name`.
 * A null value drops the row; a number claims it for that Messier object.
 *
 * M102 is the one disputed entry in the catalog. OpenNGC records it as a
 * re-observation of M101, while the reading we follow — Méchain's own later
 * correction — identifies it as NGC 5866 in Draco. Both are defensible; this
 * keeps M102 a distinct object with its own position rather than an alias of
 * a galaxy 12° away.
 */
const MESSIER_OVERRIDES = {
  M102: null,
  NGC5866: '102',
}

/**
 * Rows OpenNGC carries that are not observable targets:
 *
 * - `Dup` rows are stubs for an object catalogued twice. They are not objects
 *   in their own right, but the designation is still one a user may search
 *   for, so `duplicateAliases` folds it into the surviving object first.
 * - `NonEx` rows are catalogue entries with nothing at the position.
 * - Names containing a space are NED sub-components of a larger galaxy
 *   ("IC0080 NED01"), not objects anyone points a telescope at.
 */
function isRealObject(row) {
  return row.Type !== 'Dup' && row.Type !== 'NonEx' && !row.Name.includes(' ')
}

/**
 * Number for a row named like `NGC1952` / `IC0080A`, or null if the row
 * belongs to the other catalog. The trailing letter is part of the number:
 * NGC 5194A is a different object from NGC 5194.
 */
function nameNumberOf(row, prefix) {
  const match = new RegExp(`^${prefix}0*(\\d+[A-Z]?)$`).exec(row.Name)
  return match ? match[1] : null
}

const OPENNGC_BUILDS = [
  {
    catalog: 'M',
    file: 'messier.json',
    title: 'Messier catalog',
    /**
     * Messier number for a row, or null if the row is not one. The `M` column
     * holds the number zero-padded, or '' for the vast majority of rows.
     */
    number: (row) =>
      row.Name in MESSIER_OVERRIDES
        ? MESSIER_OVERRIDES[row.Name]
        : row.M === ''
          ? null
          : String(Number(row.M)),
    expect: 110,
  },
  {
    catalog: 'NGC',
    file: 'ngc.json',
    title: 'New General Catalogue',
    number: (row) => nameNumberOf(row, 'NGC'),
  },
  {
    catalog: 'IC',
    file: 'ic.json',
    title: 'Index Catalogue',
    number: (row) => nameNumberOf(row, 'IC'),
  },
]

/**
 * Catalogs read from VizieR. `columns` are requested by name; `_RAJ2000` and
 * `_DEJ2000` are VizieR-computed J2000 positions, which matters because both
 * of these catalogs are published in older equinoxes (LDN in B1950, Sharpless
 * in B1900) and we would otherwise have to precess them ourselves.
 *
 * Neither table carries a magnitude or a common name; both are extended
 * objects for which those mean little anyway. The constellation is computed
 * from the position rather than read, since VizieR does not supply one.
 */
const VIZIER_BUILDS = [
  {
    catalog: 'Sh2',
    file: 'sharpless.json',
    title: 'Sharpless 2 catalogue of HII regions',
    source:
      'Sharpless (1959) ApJS 4, 257 — catalogue VII/20 via VizieR (CDS, ' +
      'https://vizier.cds.unistra.fr/).',
    table: 'VII/20',
    key: 'Sh2',
    columns: ['Sh2', '_RAJ2000', '_DEJ2000'],
    type: 'HII',
    /** Sharpless numbers are conventionally written `Sh2-155`. */
    designation: (number) => `Sh2-${number}`,
    expect: 313,
  },
  {
    catalog: 'LDN',
    file: 'ldn.json',
    title: 'Lynds Catalogue of Dark Nebulae',
    source:
      'Lynds (1962) ApJS 7, 1 — catalogue VII/7A via VizieR (CDS, ' +
      'https://vizier.cds.unistra.fr/).',
    table: 'VII/7A',
    key: 'LDN',
    columns: ['LDN', '_RAJ2000', '_DEJ2000'],
    type: 'DrkN',
    // A few rows in VII/7A are clouds the catalogue never numbered; without a
    // number there is no designation to file them under, so they are dropped.
    expect: 1787,
  },
]

async function fetchCsv(name) {
  const response = await fetch(`${BASE_URL}/${name}`)
  if (!response.ok) {
    throw new Error(`${name}: HTTP ${response.status}`)
  }
  return parseCsv(await response.text())
}

async function fetchVizier(build) {
  const url =
    `https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=${build.table}` +
    `&-out.max=unlimited&-out=${build.columns.join(',')}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${build.table}: HTTP ${response.status}`)
  }
  return parseVizierTsv(await response.text())
}

/**
 * VizieR's TSV is a block of `#`-prefixed metadata, then a header row, a units
 * row, a row of dashes, and finally the data. The dashes are the only reliable
 * landmark — the metadata block's length varies by catalogue — so the header
 * is located relative to them.
 */
function parseVizierTsv(text) {
  const lines = text
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
  const separator = lines.findIndex((line) => /^-+(\t-+)*$/.test(line))
  if (separator < 2) {
    throw new Error('VizieR TSV: no column separator row found')
  }

  const columns = lines[separator - 2].split('\t').map((name) => name.trim())
  return lines.slice(separator + 1).map((line) => {
    const values = line.split('\t')
    return Object.fromEntries(
      columns.map((name, i) => [name, (values[i] ?? '').trim()]),
    )
  })
}

/** OpenNGC's CSVs are semicolon-separated with no quoting anywhere. */
function parseCsv(text) {
  const [header, ...lines] = text.trim().split('\n')
  const columns = header.split(';')
  return lines.map((line) => {
    const values = line.split(';')
    return Object.fromEntries(columns.map((name, i) => [name, values[i] ?? '']))
  })
}

/** "05:34:31.97" → hours as a decimal. */
function parseRa(text) {
  const [h, m, s] = text.split(':').map(Number)
  return round(h + m / 60 + s / 3600, 6)
}

/** "+22:00:52.1" → degrees as a decimal. */
function parseDec(text) {
  const sign = text.trim().startsWith('-') ? -1 : 1
  const [d, m, s] = text.replace(/^[+-]/, '').split(':').map(Number)
  return round(sign * (d + m / 60 + s / 3600), 6)
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * Splits an identifier into catalog prefix and number, e.g. "NGC1952" or
 * "UGC 3374". Returns null for anything not in `catalogs`.
 */
function parseIdentifier(text, catalogs) {
  const match = /^([A-Za-z][A-Za-z0-9]*?)\s*0*(\d+[A-Za-z]?)$/.exec(text.trim())
  if (!match) return null
  const catalog = catalogs.find(
    (id) => id.toLowerCase() === match[1].toLowerCase(),
  )
  return catalog ? `${catalog}${match[2]}` : null
}

/**
 * The `NGC` and `IC` columns hold the *other* numbers the same object is
 * catalogued under, and a single row may carry several ("5029,5039,5046") —
 * each optionally qualified by a NED component suffix ("3058 NED02"), which we
 * resolve to the parent object since the components are not kept.
 */
function crossReferences(column, catalog) {
  if (!column) return []
  return column
    .split(',')
    .map((value) => /^\s*0*(\d+)/.exec(value))
    .filter((match) => match !== null)
    .map((match) => `${catalog}${match[1]}`)
}

function designationsOf(row) {
  const found = []
  const add = (value) => {
    if (value && !found.includes(value)) found.push(value)
  }

  for (const designation of crossReferences(row.NGC, 'NGC')) add(designation)
  for (const designation of crossReferences(row.IC, 'IC')) add(designation)
  add(parseIdentifier(row.Name, CATALOG_ORDER))
  for (const identifier of row.Identifiers.split(',')) {
    add(parseIdentifier(identifier, IDENTIFIER_CATALOGS))
  }
  return found
}

function magnitudeOf(row) {
  // V is the visual band an observer plans against; B is the fallback for the
  // handful of rows OpenNGC has no V magnitude for.
  const value = row['V-Mag'] || row['B-Mag']
  return value === '' ? undefined : Number(value)
}

function buildObject(row, primary, aliases = new Map()) {
  const own = [primary, ...designationsOf(row)]
  const designations = [
    ...own,
    ...own.flatMap((designation) => aliases.get(designation) ?? []),
  ].filter((value, i, all) => all.indexOf(value) === i)
  designations.sort(byCatalogThenNumber)

  return {
    id: primary,
    designations,
    names: row['Common names'] ? row['Common names'].split(',') : [],
    ra: parseRa(row.RA),
    dec: parseDec(row.Dec),
    type: row.Type,
    magnitude: magnitudeOf(row),
    constellation: row.Const || undefined,
  }
}

function byCatalogThenNumber(a, b) {
  return catalogRank(a) - catalogRank(b) || numberOf(a) - numberOf(b)
}

function catalogRank(designation) {
  const index = CATALOG_ORDER.indexOf(prefixOf(designation))
  return index === -1 ? CATALOG_ORDER.length : index
}

/**
 * Matched against the registry rather than read off the string: a designation
 * is not always prefix-then-digits (`Sh2-155` has a digit in the prefix and a
 * separator after it), so pattern-matching the shape gets it wrong.
 */
function prefixOf(designation) {
  return ORDER_PREFIXES.find((prefix) => designation.startsWith(prefix)) ?? ''
}

function numberOf(designation) {
  return Number(
    designation.slice(prefixOf(designation).length).replace(/\D/g, ''),
  )
}

/**
 * Designations contributed by the dropped `Dup` rows, keyed by the designation
 * of the object they point at.
 *
 * Most of these are redundant — NGC 281's own row already lists IC 11 — but
 * the cross-reference is not always mutual (NGC 763 is a duplicate of NGC 755,
 * and NGC 755's row says nothing about it), so reading the stubs is the only
 * way to keep every spelling searchable.
 */
function duplicateAliases(rows) {
  const aliases = new Map()

  for (const row of rows) {
    if (row.Type !== 'Dup') continue
    const alias = parseIdentifier(row.Name, CATALOG_ORDER)
    const [target] = [
      ...crossReferences(row.NGC, 'NGC'),
      ...crossReferences(row.IC, 'IC'),
    ]
    if (!alias || !target) continue

    if (!aliases.has(target)) aliases.set(target, [])
    aliases.get(target).push(alias)
  }

  return aliases
}

function buildVizierObject(row, build) {
  const ra = round(Number(row._RAJ2000) / 15, 6)
  const dec = round(Number(row._DEJ2000), 6)
  const number = String(Number(row[build.key]))
  const designation = build.designation
    ? build.designation(number)
    : `${build.catalog}${number}`

  return {
    id: designation,
    designations: [designation],
    names: [],
    ra,
    dec,
    type: build.type,
    constellation: Constellation(ra, dec).symbol,
  }
}

async function writeCatalog(build, source, objects) {
  if (build.expect && objects.length !== build.expect) {
    throw new Error(
      `${build.catalog}: expected ${build.expect} objects, got ${objects.length}`,
    )
  }

  await writeFile(
    join(OUT_DIR, build.file),
    JSON.stringify(
      { catalog: build.catalog, title: build.title, source, objects },
      null,
      1,
    ) + '\n',
  )
  console.log(`${build.file}: ${objects.length} objects`)
}

async function buildFromOpenNgc(rows, aliases) {
  for (const build of OPENNGC_BUILDS) {
    const objects = []
    const claimedBy = new Map()

    for (const row of rows) {
      const number = build.number(row)
      if (number === null) continue

      const primary = `${build.catalog}${number}`

      // Two rows claiming the same designation means the source disagrees with
      // itself, or an override collides with a real row. Neither is something
      // to paper over silently — add a MESSIER_OVERRIDES entry to resolve it.
      if (claimedBy.has(primary)) {
        throw new Error(
          `${primary}: claimed by both ${claimedBy.get(primary)} and ${row.Name}`,
        )
      }

      claimedBy.set(primary, row.Name)
      objects.push(buildObject(row, primary, aliases))
    }

    objects.sort((a, b) => numberOf(a.id) - numberOf(b.id))
    await writeCatalog(build, SOURCE, objects)
  }
}

async function buildFromVizier() {
  for (const build of VIZIER_BUILDS) {
    const rows = await fetchVizier(build)
    const objects = rows
      // Unnumbered rows have no designation to file them under; rows without a
      // position cannot be plotted. Both exist in VII/7A.
      .filter((row) => row[build.key] && row._RAJ2000 && row._DEJ2000)
      .map((row) => buildVizierObject(row, build))

    objects.sort((a, b) => numberOf(a.id) - numberOf(b.id))
    await writeCatalog(build, build.source, objects)
  }
}

async function main() {
  const [ngc, addendum] = await Promise.all([
    fetchCsv('NGC.csv'),
    fetchCsv('addendum.csv'),
  ])
  const rows = [...ngc, ...addendum]

  await mkdir(OUT_DIR, { recursive: true })
  await buildFromOpenNgc(rows.filter(isRealObject), duplicateAliases(rows))
  await buildFromVizier()
}

await main()
