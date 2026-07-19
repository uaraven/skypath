/**
 * The narrow slice of browser storage the app persists through, and the two
 * implementations of it.
 *
 * Extracted out of `observatory/store.ts` in Phase 7, when the session store
 * became the second thing needing exactly the same `localStorage` handling —
 * including the Node-experimental-global trap below, which is not obvious
 * enough to want a second copy of.
 */

/** The slice of the `Storage` API we use; lets tests hand in a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** localStorage when it is usable, null in Node or when storage is blocked. */
export function defaultStorage(): KeyValueStore | null {
  try {
    // Reached through `window` rather than as a bare global: Node exposes an
    // experimental `localStorage` of its own and warns on any access to it,
    // which would otherwise fire on every `npm test` run.
    if (typeof window === 'undefined') return null
    const storage = window.localStorage
    // Node's experimental global yields `undefined` rather than a Storage, so
    // check for the methods instead of trusting the type.
    return typeof storage?.getItem === 'function' ? storage : null
  } catch {
    // Safari throws on access when cookies are fully blocked.
    return null
  }
}

/**
 * A `KeyValueStore` backed by a plain Map.
 *
 * Used by tests to give each case its own isolated "browser storage", and
 * available to the app as a fallback if a non-persistent session is ever
 * wanted.
 */
export class MemoryStorage implements KeyValueStore {
  readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}
