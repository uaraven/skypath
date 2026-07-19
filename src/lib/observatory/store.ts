/**
 * The observatory list, persisted to localStorage.
 *
 * Two invariants hold at all times, so callers never have to handle "no site
 * configured": the list is **never empty**, and exactly one observatory is
 * **always selected**. Deleting the last one recreates the default rather than
 * leaving the app without a location.
 *
 * The store implements the Svelte store contract (`subscribe` returning an
 * unsubscribe function), so components can read it as `$observatories` while
 * the module itself stays plain TypeScript and testable under Node.
 */

import { defaultStorage, type KeyValueStore } from '../storage'
import { isObservatory, type Observatory, type ObservatoryInput } from './types'

/** Single versioned key holding the whole store, per the implementation plan. */
export const STORAGE_KEY = 'flightplan.observatories.v1'

const SCHEMA_VERSION = 1

export interface ObservatoryState {
  observatories: Observatory[]
  selectedId: string
}

/**
 * The site a first-time visitor starts with. Greenwich rather than 0°/0°: it is
 * a real observatory, it makes the charts show something plausible immediately,
 * and it is obviously a placeholder to anyone who cares where they are.
 */
export const DEFAULT_OBSERVATORY: ObservatoryInput = {
  name: 'Greenwich',
  latitude: 51.4779,
  longitude: -0.0015,
  elevation: 47,
  horizonText: '',
}

export class ObservatoryStore {
  #state: ObservatoryState
  #storage: KeyValueStore | null
  #listeners = new Set<(state: ObservatoryState) => void>()

  constructor(storage: KeyValueStore | null = defaultStorage()) {
    this.#storage = storage
    this.#state = this.#read()
  }

  get state(): ObservatoryState {
    return this.#state
  }

  get all(): Observatory[] {
    return this.#state.observatories
  }

  /** The observatory driving every calculation. Never undefined. */
  get selected(): Observatory {
    const found = this.#state.observatories.find(
      (o) => o.id === this.#state.selectedId,
    )
    // The invariant is maintained on every mutation; this is belt and braces
    // for a hand-edited localStorage that slipped past validation.
    return found ?? this.#state.observatories[0]
  }

  byId(id: string): Observatory | undefined {
    return this.#state.observatories.find((o) => o.id === id)
  }

  /** Adds an observatory and selects it. */
  create(input: ObservatoryInput): Observatory {
    const observatory: Observatory = { ...input, id: newId() }
    this.#commit({
      observatories: [...this.#state.observatories, observatory],
      selectedId: observatory.id,
    })
    return observatory
  }

  /** Applies a partial edit. Unknown ids are ignored. */
  update(id: string, patch: Partial<ObservatoryInput>): void {
    if (!this.byId(id)) return
    this.#commit({
      ...this.#state,
      observatories: this.#state.observatories.map((o) =>
        o.id === id ? { ...o, ...patch, id } : o,
      ),
    })
  }

  /**
   * Removes an observatory. If it was the selected one, selection moves to the
   * neighbour that took its place in the list; if it was the last one, the
   * default observatory is recreated.
   */
  remove(id: string): void {
    const index = this.#state.observatories.findIndex((o) => o.id === id)
    if (index === -1) return

    const observatories = this.#state.observatories.filter((o) => o.id !== id)
    if (observatories.length === 0) {
      this.#commit(initialState())
      return
    }

    const selectedId =
      this.#state.selectedId === id
        ? observatories[Math.min(index, observatories.length - 1)].id
        : this.#state.selectedId
    this.#commit({ observatories, selectedId })
  }

  /** Selects an existing observatory; unknown ids are ignored. */
  select(id: string): void {
    if (!this.byId(id)) return
    this.#commit({ ...this.#state, selectedId: id })
  }

  /** Svelte store contract: calls `run` immediately, then on every change. */
  subscribe(run: (state: ObservatoryState) => void): () => void {
    this.#listeners.add(run)
    run(this.#state)
    return () => this.#listeners.delete(run)
  }

  /** Drops persisted data and returns to the first-launch state. Tests, and a future "reset" button. */
  reset(): void {
    this.#storage?.removeItem(STORAGE_KEY)
    this.#commit(initialState())
  }

  #commit(state: ObservatoryState): void {
    this.#state = state
    this.#write(state)
    for (const listener of this.#listeners) listener(state)
  }

  #read(): ObservatoryState {
    const raw = this.#storage?.getItem(STORAGE_KEY)
    if (!raw) return initialState()

    try {
      const parsed: unknown = JSON.parse(raw)
      const state = restore(parsed)
      if (state) return state
    } catch {
      // Corrupt JSON — fall through to the default rather than breaking boot.
    }
    return initialState()
  }

  #write(state: ObservatoryState): void {
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
 * Rebuilds state from parsed JSON, dropping entries that do not survive
 * validation. Returns null when nothing usable is left, so the caller can fall
 * back to the defaults.
 */
function restore(parsed: unknown): ObservatoryState | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const candidate = parsed as {
    observatories?: unknown
    selectedId?: unknown
  }
  if (!Array.isArray(candidate.observatories)) return null

  const observatories = candidate.observatories.filter(isObservatory)
  if (observatories.length === 0) return null

  const selectedId =
    typeof candidate.selectedId === 'string' &&
    observatories.some((o) => o.id === candidate.selectedId)
      ? candidate.selectedId
      : observatories[0].id

  return { observatories, selectedId }
}

function initialState(): ObservatoryState {
  const observatory: Observatory = { ...DEFAULT_OBSERVATORY, id: newId() }
  return { observatories: [observatory], selectedId: observatory.id }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** The app-wide store. Tests build their own with an injected storage. */
export const observatories = new ObservatoryStore()
