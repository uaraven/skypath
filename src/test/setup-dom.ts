/**
 * Setup for the jsdom-backed component project.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/svelte'
import { afterEach, beforeEach } from 'vitest'

/**
 * Vitest's jsdom environment aliases `window` to `globalThis`, where Node 26's
 * experimental `localStorage` wins: reading it warns and yields `undefined`.
 * Component code reaching for localStorage would therefore see *no* storage,
 * which is not how a browser behaves. Install a deterministic in-memory
 * Storage instead, cleared between tests so cases stay isolated.
 */
const entries = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size
    },
  } satisfies Storage,
})

beforeEach(() => entries.clear())

/**
 * Registered explicitly because Vitest runs without `globals`, so
 * testing-library cannot find an `afterEach` to hook itself into — without
 * this, components from one test stay mounted and the next test's queries find
 * two of everything.
 */
afterEach(cleanup)
