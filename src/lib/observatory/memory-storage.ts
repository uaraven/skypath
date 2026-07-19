import type { KeyValueStore } from './store'

/**
 * A `KeyValueStore` backed by a plain Map.
 *
 * Used by tests to give each case its own isolated "browser storage", and
 * available to the app as a fallback if a non-persistent session is ever
 * wanted. Kept out of `index.ts` — it is not part of the observatory API.
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
