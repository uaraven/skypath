/**
 * The rest of what the user chose, persisted beside the observatories: which
 * object is open, and which night. Reopening the tab should put you back where
 * you were rather than on "no object, tonight".
 *
 * Kept separate from the observatory store, and under its own key, because the
 * two have different shapes and different lifetimes: observatories are data the
 * user curates, this is where they happened to be looking. A corrupt or absent
 * session is always recoverable by falling back to the defaults — it never
 * takes the app down with it.
 */

import { nightWindow } from '../astro/time'
import { defaultStorage, type KeyValueStore } from '../storage'

export const SESSION_KEY = 'skypath.session.v1'

const SCHEMA_VERSION = 1

export interface Session {
  /** Catalog id (`M13`, `jupiter`), or null when nothing is chosen yet. */
  objectId: string | null
  /** The chosen night as `YYYY-MM-DD`, the form `<input type="date">` speaks. */
  dateText: string | null
}

const EMPTY: Session = { objectId: null, dateText: null }

export class SessionStore {
  #state: Session
  #storage: KeyValueStore | null

  constructor(storage: KeyValueStore | null = defaultStorage()) {
    this.#storage = storage
    this.#state = this.#read()
  }

  get state(): Session {
    return this.#state
  }

  /**
   * The night to open on: the saved one while its noon→noon window is still
   * running, otherwise today.
   *
   * The window rather than the calendar date is what matters. A date saved at
   * 23:00 is "yesterday" by 01:00, but the observing night it names has four
   * more hours to run — resetting it then would move the charts off the night
   * the user is in the middle of.
   */
  dateOr(today: Date): Date {
    const saved = this.#state.dateText && parseIsoDate(this.#state.dateText)
    if (!saved) return today
    return nightWindow(saved).end > today ? saved : today
  }

  setObjectId(objectId: string | null): void {
    this.#commit({ ...this.#state, objectId })
  }

  setDate(date: Date): void {
    this.#commit({ ...this.#state, dateText: formatIsoDate(date) })
  }

  /** Drops the persisted session and returns to first-launch state. */
  reset(): void {
    this.#storage?.removeItem(SESSION_KEY)
    this.#state = EMPTY
  }

  #commit(state: Session): void {
    this.#state = state
    if (!this.#storage) return
    try {
      this.#storage.setItem(
        SESSION_KEY,
        JSON.stringify({ version: SCHEMA_VERSION, ...state }),
      )
    } catch {
      // Quota exceeded or storage disabled mid-session. The in-memory state is
      // still right for this session, which is the best that can be done.
    }
  }

  #read(): Session {
    const raw = this.#storage?.getItem(SESSION_KEY)
    if (!raw) return EMPTY

    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return EMPTY
      const candidate = parsed as { objectId?: unknown; dateText?: unknown }
      return {
        objectId:
          typeof candidate.objectId === 'string' ? candidate.objectId : null,
        // Validated by parsing, not by shape: a well-formed but impossible
        // date ("2026-02-31") would otherwise reach the charts.
        dateText:
          typeof candidate.dateText === 'string' &&
          parseIsoDate(candidate.dateText)
            ? candidate.dateText
            : null,
      }
    } catch {
      // Corrupt JSON — start fresh rather than breaking boot.
      return EMPTY
    }
  }
}

/** A `Date` as `YYYY-MM-DD` in *local* time, matching `<input type="date">`. */
export function formatIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * `YYYY-MM-DD` as *local* midnight, or null if it is not a real date.
 *
 * `new Date('2026-07-19')` would be read as UTC and land on the previous day
 * west of Greenwich, shifting the whole noon→noon window by a night. The
 * round-trip check rejects overflowing dates, which the Date constructor
 * otherwise rolls forward silently (Feb 31 → Mar 3).
 */
export function parseIsoDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null
}

/** The app-wide session. Tests build their own with an injected storage. */
export const session = new SessionStore()
