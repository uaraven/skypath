/**
 * The rig list, persisted to localStorage — the same pattern as
 * `observatory/store.ts`, with one deliberate divergence: **the list may be
 * empty and nothing may be selected.** Observatories can't be empty because
 * every chart calculation needs a location; nothing in the app needs a rig,
 * and inventing a plausible default telescope would be inventing a fact
 * about the user's equipment. First run therefore shows an empty rig list,
 * and the framing assistant falls back to today's object-sized sky view.
 *
 * Implements the Svelte store contract (`subscribe` returning an unsubscribe
 * function) so components can read it as `$rigs` while the module itself
 * stays plain TypeScript and testable under Node.
 */

import { defaultStorage, type KeyValueStore } from '../storage'
import { isRig, type Rig, type RigInput } from './types'

/** Single versioned key holding the whole store. */
export const STORAGE_KEY = 'skypath.rigs.v1'

const SCHEMA_VERSION = 1

export interface RigState {
  rigs: Rig[]
  selectedId: string | null
}

const EMPTY_STATE: RigState = { rigs: [], selectedId: null }

export class RigStore {
  #state: RigState
  #storage: KeyValueStore | null
  #listeners = new Set<(state: RigState) => void>()

  constructor(storage: KeyValueStore | null = defaultStorage()) {
    this.#storage = storage
    this.#state = this.#read()
  }

  get state(): RigState {
    return this.#state
  }

  get all(): Rig[] {
    return this.#state.rigs
  }

  /** The rig driving the framing assistant, or null when none is selected. */
  get selected(): Rig | null {
    return selectedRig(this.#state)
  }

  byId(id: string): Rig | undefined {
    return this.#state.rigs.find((r) => r.id === id)
  }

  /** Adds a rig and selects it. */
  create(input: RigInput): Rig {
    const rig: Rig = { ...input, id: newId() }
    this.#commit({
      rigs: [...this.#state.rigs, rig],
      selectedId: rig.id,
    })
    return rig
  }

  /** Applies a partial edit. Unknown ids are ignored. */
  update(id: string, patch: Partial<RigInput>): void {
    if (!this.byId(id)) return
    this.#commit({
      ...this.#state,
      rigs: this.#state.rigs.map((r) =>
        r.id === id ? { ...r, ...patch, id } : r,
      ),
    })
  }

  /**
   * Removes a rig. If it was the selected one, selection moves to the
   * neighbour that took its place in the list; if it was the last one, the
   * list is simply left empty rather than reaching for a default.
   */
  remove(id: string): void {
    const index = this.#state.rigs.findIndex((r) => r.id === id)
    if (index === -1) return

    const rigs = this.#state.rigs.filter((r) => r.id !== id)
    if (rigs.length === 0) {
      this.#commit(EMPTY_STATE)
      return
    }

    const selectedId =
      this.#state.selectedId === id
        ? rigs[Math.min(index, rigs.length - 1)].id
        : this.#state.selectedId
    this.#commit({ rigs, selectedId })
  }

  /**
   * Bulk import from a file. `append` adds only entries whose id isn't
   * already present, so re-importing a file exported from this browser is a
   * no-op rather than a source of duplicates; selection is left where it
   * was. `overwrite` replaces the whole list and selects the first entry (or
   * nothing, if the incoming list is empty — unlike observatories, an empty
   * rig list is a legal state).
   */
  importRigs(
    incoming: Rig[],
    mode: 'append' | 'overwrite',
  ): { added: number; skipped: number } {
    if (mode === 'overwrite') {
      this.#commit({
        rigs: incoming,
        selectedId: incoming[0]?.id ?? null,
      })
      return { added: incoming.length, skipped: 0 }
    }

    if (incoming.length === 0) return { added: 0, skipped: 0 }

    const existingIds = new Set(this.#state.rigs.map((r) => r.id))
    const added = incoming.filter((r) => !existingIds.has(r.id))
    if (added.length > 0) {
      this.#commit({
        ...this.#state,
        rigs: [...this.#state.rigs, ...added],
      })
    }
    return { added: added.length, skipped: incoming.length - added.length }
  }

  /**
   * Moves `id` to sit immediately before or after `targetId`, for drag-and-
   * drop reordering. A no-op if either id is unknown or they're the same
   * entry.
   */
  reorder(id: string, targetId: string, position: 'before' | 'after'): void {
    if (id === targetId) return
    const rigs = this.#state.rigs
    if (!rigs.some((r) => r.id === id)) return

    const moved = rigs.find((r) => r.id === id)!
    const without = rigs.filter((r) => r.id !== id)
    const targetIndex = without.findIndex((r) => r.id === targetId)
    if (targetIndex === -1) return

    const insertAt = position === 'before' ? targetIndex : targetIndex + 1
    without.splice(insertAt, 0, moved)
    this.#commit({ ...this.#state, rigs: without })
  }

  /** Selects an existing rig; unknown ids are ignored. */
  select(id: string): void {
    if (!this.byId(id)) return
    this.#commit({ ...this.#state, selectedId: id })
  }

  /** Clears the selection without removing anything — "no rig chosen". */
  deselect(): void {
    this.#commit({ ...this.#state, selectedId: null })
  }

  /** Svelte store contract: calls `run` immediately, then on every change. */
  subscribe(run: (state: RigState) => void): () => void {
    this.#listeners.add(run)
    run(this.#state)
    return () => this.#listeners.delete(run)
  }

  /** Drops persisted data and returns to the first-launch state. Tests, and a future "reset" button. */
  reset(): void {
    this.#storage?.removeItem(STORAGE_KEY)
    this.#commit(EMPTY_STATE)
  }

  #commit(state: RigState): void {
    this.#state = state
    this.#write(state)
    for (const listener of this.#listeners) listener(state)
  }

  #read(): RigState {
    const raw = this.#storage?.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATE

    try {
      const parsed: unknown = JSON.parse(raw)
      const state = restore(parsed)
      if (state) return state
    } catch {
      // Corrupt JSON — fall through to empty rather than breaking boot.
    }
    return EMPTY_STATE
  }

  #write(state: RigState): void {
    if (!this.#storage) return
    try {
      this.#storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: SCHEMA_VERSION, ...state }),
      )
    } catch {
      // Quota exceeded or storage disabled mid-session: the in-memory state
      // stays correct for this session, which is the best we can do offline.
    }
  }
}

/**
 * The selected rig for a given state, or null when nothing is selected or
 * the selection dangles (a hand-edited localStorage might do that; the
 * store's own operations never leave a dangling id).
 */
export function selectedRig(state: RigState): Rig | null {
  if (state.selectedId === null) return null
  return state.rigs.find((r) => r.id === state.selectedId) ?? null
}

/**
 * Rebuilds state from parsed JSON, dropping entries that do not survive
 * validation. An empty or all-invalid `rigs` array is a legal result (unlike
 * observatories) — it just means the persisted list restores to empty.
 */
function restore(parsed: unknown): RigState | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const candidate = parsed as { rigs?: unknown; selectedId?: unknown }
  if (!Array.isArray(candidate.rigs)) return null

  const rigs = candidate.rigs.filter(isRig)
  const selectedId =
    typeof candidate.selectedId === 'string' &&
    rigs.some((r) => r.id === candidate.selectedId)
      ? candidate.selectedId
      : null

  return { rigs, selectedId }
}

function newId(): string {
  return (
    crypto?.randomUUID?.() ??
    `rig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  )
}

/** The app-wide store. Tests build their own with an injected storage. */
export const rigs = new RigStore()
