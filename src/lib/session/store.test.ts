import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorage, type KeyValueStore } from '../storage'
import { formatIsoDate, parseIsoDate, SESSION_KEY, SessionStore } from './store'

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
})

function persisted(storage: MemoryStorage) {
  return JSON.parse(storage.getItem(SESSION_KEY)!)
}

describe('first launch', () => {
  it('starts with nothing chosen', () => {
    const store = new SessionStore(storage)

    expect(store.state).toEqual({ objectId: null, dateText: null })
  })

  it('opens on today when no date was saved', () => {
    const today = new Date(2026, 6, 19)

    expect(new SessionStore(storage).dateOr(today)).toEqual(today)
  })
})

describe('persistence', () => {
  it('restores the object and the date across a reload', () => {
    const store = new SessionStore(storage)
    store.setObjectId('M13')
    store.setDate(new Date(2026, 9, 15))

    const reloaded = new SessionStore(storage)

    expect(reloaded.state).toEqual({ objectId: 'M13', dateText: '2026-10-15' })
  })

  it('writes a version alongside the state', () => {
    new SessionStore(storage).setObjectId('jupiter')

    expect(persisted(storage).version).toBe(1)
  })

  it('clears the object when nothing is selected', () => {
    const store = new SessionStore(storage)
    store.setObjectId('M13')
    store.setObjectId(null)

    expect(new SessionStore(storage).state.objectId).toBeNull()
  })

  it('reset drops the stored session', () => {
    const store = new SessionStore(storage)
    store.setObjectId('M13')
    store.reset()

    expect(storage.getItem(SESSION_KEY)).toBeNull()
    expect(store.state.objectId).toBeNull()
  })
})

describe('recovering from bad stored data', () => {
  it('falls back to empty on corrupt JSON', () => {
    storage.setItem(SESSION_KEY, '{not json')

    expect(new SessionStore(storage).state).toEqual({
      objectId: null,
      dateText: null,
    })
  })

  it('ignores a date that is well-formed but not a real day', () => {
    storage.setItem(
      SESSION_KEY,
      JSON.stringify({ objectId: 'M13', dateText: '2026-02-31' }),
    )

    const store = new SessionStore(storage)

    // The object survives — one bad field should not discard the other.
    expect(store.state.objectId).toBe('M13')
    expect(store.state.dateText).toBeNull()
  })

  it('ignores fields of the wrong type', () => {
    storage.setItem(
      SESSION_KEY,
      JSON.stringify({ objectId: 42, dateText: ['2026-10-15'] }),
    )

    expect(new SessionStore(storage).state).toEqual({
      objectId: null,
      dateText: null,
    })
  })

  it('survives absent storage', () => {
    const store = new SessionStore(null)
    store.setObjectId('M13')

    expect(store.state.objectId).toBe('M13')
  })

  it('survives a storage that throws on write', () => {
    const failing: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    const store = new SessionStore(failing)

    expect(() => store.setObjectId('M13')).not.toThrow()
    expect(store.state.objectId).toBe('M13')
  })
})

/**
 * The rule the app opens on: a saved night is kept until its own noon→noon
 * window has run out, not until its calendar date has.
 */
describe('which night to open on', () => {
  function storeSavedOn(date: Date) {
    const store = new SessionStore(storage)
    store.setDate(date)
    return new SessionStore(storage)
  }

  it('keeps a future date', () => {
    const store = storeSavedOn(new Date(2026, 9, 15))

    expect(store.dateOr(new Date(2026, 6, 19, 20))).toEqual(
      new Date(2026, 9, 15),
    )
  })

  it("keeps today's date", () => {
    const store = storeSavedOn(new Date(2026, 6, 19))

    expect(store.dateOr(new Date(2026, 6, 19, 20))).toEqual(
      new Date(2026, 6, 19),
    )
  })

  it('keeps last night after midnight, while its window is still running', () => {
    const store = storeSavedOn(new Date(2026, 6, 19))

    // 01:00 on the 20th is still inside the night of the 19th.
    expect(store.dateOr(new Date(2026, 6, 20, 1))).toEqual(
      new Date(2026, 6, 19),
    )
  })

  it('drops last night once its window has closed', () => {
    const store = storeSavedOn(new Date(2026, 6, 19))
    const now = new Date(2026, 6, 20, 13)

    // 13:00 on the 20th is past the window's noon end — plan tonight instead.
    expect(store.dateOr(now)).toEqual(now)
  })

  it('drops a stale date from weeks ago', () => {
    const store = storeSavedOn(new Date(2026, 5, 1))
    const now = new Date(2026, 6, 19, 20)

    expect(store.dateOr(now)).toEqual(now)
  })
})

describe('ISO date conversion', () => {
  it('round-trips a local date', () => {
    const date = new Date(2026, 0, 5)

    expect(formatIsoDate(date)).toBe('2026-01-05')
    expect(parseIsoDate('2026-01-05')).toEqual(date)
  })

  it('parses as local midnight, not UTC', () => {
    // `new Date('2026-07-19')` is UTC midnight, which is the 18th anywhere
    // west of Greenwich — a whole night out.
    const parsed = parseIsoDate('2026-07-19')!

    expect(parsed.getHours()).toBe(0)
    expect(parsed.getDate()).toBe(19)
  })

  it('rejects malformed and impossible dates', () => {
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate('19/07/2026')).toBeNull()
    expect(parseIsoDate('2026-7-9')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('2026-02-31')).toBeNull()
  })
})
