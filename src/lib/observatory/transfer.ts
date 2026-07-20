/**
 * Moving observatories between browsers and machines as a JSON file.
 *
 * Observatories otherwise live only in localStorage, so this is the one bridge
 * off a single machine. The horizon travels as the raw NINA text it is already
 * stored as, so a site survives the round trip byte for byte. `selectedId` is
 * deliberately *not* exported: which site you had highlighted is a property of
 * this browser, not of the collection.
 */

import { isObservatory, type Observatory } from './types'

export const EXPORT_VERSION = 1

/** The envelope written to disk. Tagged so an import can recognise its own files. */
export interface ObservatoryExport {
  app: 'skypath'
  kind: 'observatories'
  version: number
  /** ISO 8601, purely informational — nothing reads it back. */
  exportedAt: string
  observatories: Observatory[]
}

export interface ImportResult {
  /** Entries that passed `isObservatory`, de-duplicated by id. */
  observatories: Observatory[]
  /** How many entries were dropped because they failed validation. */
  invalid: number
  /** Set when the file could not be read at all; `observatories` is then empty. */
  error?: string
}

/** Serialises the whole collection into the export envelope, pretty-printed. */
export function serializeObservatories(list: Observatory[]): string {
  const payload: ObservatoryExport = {
    app: 'skypath',
    kind: 'observatories',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    observatories: list,
  }
  return JSON.stringify(payload, null, 2)
}

/**
 * Reads an import file. Lenient about the container — it accepts our own
 * envelope, a bare array of observatories, or the localStorage `{observatories}`
 * shape — so a user can feed it whatever they have to hand. Every entry is run
 * through `isObservatory`; anything that fails is counted, not trusted.
 */
export function parseObservatoryImport(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { observatories: [], invalid: 0, error: 'Not valid JSON.' }
  }

  const array = extractArray(parsed)
  if (array === null) {
    return {
      observatories: [],
      invalid: 0,
      error: 'No observatories found in this file.',
    }
  }

  const valid = array.filter(isObservatory)
  const observatories = dedupeById(valid)
  return { observatories, invalid: array.length - valid.length }
}

/** Finds the observatories array in whichever supported container it arrived in. */
function extractArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  if (typeof parsed === 'object' && parsed !== null) {
    const list = (parsed as { observatories?: unknown }).observatories
    if (Array.isArray(list)) return list
  }
  return null
}

/** Keeps the first entry for each id, so a file that repeats one imports it once. */
function dedupeById(list: Observatory[]): Observatory[] {
  const seen = new Set<string>()
  return list.filter((o) => {
    if (seen.has(o.id)) return false
    seen.add(o.id)
    return true
  })
}
