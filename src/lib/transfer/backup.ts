/**
 * Moving both managed collections — observatories and rigs — between browsers
 * and machines as a single JSON file.
 *
 * Lives above both domains rather than inside either: neither
 * `lib/observatory` nor `lib/rig` should import the other, and export/import
 * is the one place that legitimately needs both at once. `selectedId` is not
 * exported for either collection, for the same reason `observatory/transfer`
 * already gives: highlight is a property of the browser, not the collection.
 *
 * Lenient about the container it reads, same spirit as
 * `parseObservatoryImport`: it accepts this module's own v2 envelope, a v1
 * observatory-only envelope (`{observatories}`), or a bare array of
 * observatories — the only shapes any past export of this app has ever
 * produced, none of which carried rigs. Those files import with `rigs: []`.
 */

import { isObservatory, type Observatory } from '../observatory/types'
import { isRig, type Rig } from '../rig/types'

export const BACKUP_VERSION = 2

/** The envelope written to disk. Tagged so an import can recognise its own files. */
export interface BackupFile {
  app: 'skypath'
  kind: 'backup'
  version: number
  /** ISO 8601, purely informational — nothing reads it back. */
  exportedAt: string
  observatories: Observatory[]
  rigs: Rig[]
}

export interface BackupImport {
  /** Entries that passed `isObservatory`, de-duplicated by id. */
  observatories: Observatory[]
  /** Entries that passed `isRig`, de-duplicated by id. */
  rigs: Rig[]
  /** How many observatory entries were dropped because they failed validation. */
  invalidObservatories: number
  /** How many rig entries were dropped because they failed validation. */
  invalidRigs: number
  /** Set when the file could not be read at all; both lists are then empty. */
  error?: string
}

/** Serialises both collections into the backup envelope, pretty-printed. */
export function serializeBackup(
  observatories: Observatory[],
  rigs: Rig[],
): string {
  const payload: BackupFile = {
    app: 'skypath',
    kind: 'backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    observatories,
    rigs,
  }
  return JSON.stringify(payload, null, 2)
}

/**
 * Reads an import file. Every entry is run through the matching type guard;
 * anything that fails is counted, not trusted.
 */
export function parseBackup(text: string): BackupImport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      observatories: [],
      rigs: [],
      invalidObservatories: 0,
      invalidRigs: 0,
      error: 'Not valid JSON.',
    }
  }

  const containers = extractContainers(parsed)
  if (!containers) {
    return {
      observatories: [],
      rigs: [],
      invalidObservatories: 0,
      invalidRigs: 0,
      error: 'No observatories or rigs found in this file.',
    }
  }

  const { observatoriesRaw, rigsRaw } = containers
  const validObservatories = observatoriesRaw.filter(isObservatory)
  const validRigs = rigsRaw.filter(isRig)

  return {
    observatories: dedupeById(validObservatories),
    rigs: dedupeById(validRigs),
    invalidObservatories: observatoriesRaw.length - validObservatories.length,
    invalidRigs: rigsRaw.length - validRigs.length,
  }
}

/**
 * Finds the observatories and rigs arrays in whichever supported container
 * the file arrived in. Returns null only when neither array is present at
 * all — a file with one empty and one missing is still a legible backup.
 */
function extractContainers(
  parsed: unknown,
): { observatoriesRaw: unknown[]; rigsRaw: unknown[] } | null {
  // A v1 observatories export was a bare array — rigs did not exist yet.
  if (Array.isArray(parsed)) {
    return { observatoriesRaw: parsed, rigsRaw: [] }
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const container = parsed as { observatories?: unknown; rigs?: unknown }
  const observatoriesRaw = Array.isArray(container.observatories)
    ? container.observatories
    : []
  const rigsRaw = Array.isArray(container.rigs) ? container.rigs : []
  if (
    !Array.isArray(container.observatories) &&
    !Array.isArray(container.rigs)
  ) {
    return null
  }
  return { observatoriesRaw, rigsRaw }
}

/** Keeps the first entry for each id, so a file that repeats one imports it once. */
function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
