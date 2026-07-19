#!/usr/bin/env node
/**
 * Regenerates the bundled deep-sky catalog files from OpenNGC.
 *
 *   node scripts/build-catalog.mjs
 *
 * Source: https://github.com/mattiaverga/OpenNGC (CC-BY-SA-4.0). The two CSVs
 * are downloaded on each run and not kept in the repo; only the generated
 * JSON under src/lib/catalog/data/ is committed.
 *
 * To add another OpenNGC-derived catalog (NGC, IC, …), append an entry to
 * BUILDS below and register the catalog in src/lib/catalog/catalogs.ts.
 * Catalogs OpenNGC does not carry (Sharpless 2, …) need their own importer,
 * but must emit the same JSON shape — see the header comment in dso.ts.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** Order in which designations are listed on an object; earliest wins as primary. */
const CATALOG_ORDER = ['M', 'NGC', 'IC', 'Mel', 'Cr', 'UGC', 'PGC', 'LBN']

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

const BUILDS = [
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
]

async function fetchCsv(name) {
  const response = await fetch(`${BASE_URL}/${name}`)
  if (!response.ok) {
    throw new Error(`${name}: HTTP ${response.status}`)
  }
  return parseCsv(await response.text())
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

function designationsOf(row) {
  const found = []
  const add = (value) => {
    if (value && !found.includes(value)) found.push(value)
  }

  if (row.NGC) add(`NGC${Number(row.NGC)}`)
  if (row.IC) add(`IC${Number(row.IC)}`)
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

function buildObject(row, primary) {
  const designations = [primary, ...designationsOf(row)].filter(
    (value, i, all) => all.indexOf(value) === i,
  )
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

function prefixOf(designation) {
  return /^[A-Za-z][A-Za-z0-9]*?(?=\d)/.exec(designation)?.[0] ?? ''
}

function numberOf(designation) {
  return Number(
    designation.slice(prefixOf(designation).length).replace(/\D/g, ''),
  )
}

async function main() {
  const [ngc, addendum] = await Promise.all([
    fetchCsv('NGC.csv'),
    fetchCsv('addendum.csv'),
  ])
  const rows = [...ngc, ...addendum]

  await mkdir(OUT_DIR, { recursive: true })

  for (const build of BUILDS) {
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
      objects.push(buildObject(row, primary))
    }

    objects.sort(
      (a, b) =>
        Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, '')),
    )

    if (build.expect && objects.length !== build.expect) {
      throw new Error(
        `${build.catalog}: expected ${build.expect} objects, got ${objects.length}`,
      )
    }

    const path = join(OUT_DIR, build.file)
    await writeFile(
      path,
      JSON.stringify(
        { catalog: build.catalog, title: build.title, source: SOURCE, objects },
        null,
        1,
      ) + '\n',
    )
    console.log(`${build.file}: ${objects.length} objects`)
  }
}

await main()
