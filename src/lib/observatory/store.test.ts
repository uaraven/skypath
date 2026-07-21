import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_OBSERVATORY,
  ObservatoryStore,
  selectedObservatory,
  STORAGE_KEY,
} from './store'
import { MemoryStorage, type KeyValueStore } from '../storage'
import {
  observatoryLocation,
  type Observatory,
  type ObservatoryInput,
} from './types'

const KYIV: ObservatoryInput = {
  name: 'Kyiv balcony',
  latitude: 50.45,
  longitude: 30.52,
  horizonText: '0 20\n180 5',
}

const DARK_SITE: ObservatoryInput = {
  name: 'Dark site',
  latitude: 49.1,
  longitude: 31.3,
  elevation: 220,
  horizonText: '',
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
})

describe('selectedObservatory', () => {
  const a: Observatory = { ...KYIV, id: 'a' }
  const b: Observatory = { ...DARK_SITE, id: 'b' }

  it('returns the entry matching selectedId', () => {
    expect(
      selectedObservatory({ observatories: [a, b], selectedId: 'b' }),
    ).toBe(b)
  })

  it('falls back to the first entry when selectedId dangles', () => {
    expect(
      selectedObservatory({ observatories: [a, b], selectedId: 'gone' }),
    ).toBe(a)
  })
})

describe('first launch', () => {
  it('starts with the default observatory selected', () => {
    const store = new ObservatoryStore(storage)

    expect(store.all).toHaveLength(1)
    expect(store.selected).toMatchObject(DEFAULT_OBSERVATORY)
    expect(store.selected.id).toBeTruthy()
  })

  it('works with no storage at all', () => {
    const store = new ObservatoryStore(null)

    store.create(KYIV)
    expect(store.selected.name).toBe('Kyiv balcony')
  })
})

describe('CRUD', () => {
  it('creates an observatory and selects it', () => {
    const store = new ObservatoryStore(storage)

    const created = store.create(KYIV)

    expect(store.all).toHaveLength(2)
    expect(store.selected.id).toBe(created.id)
    expect(store.selected.name).toBe('Kyiv balcony')
  })

  it('gives each observatory a distinct id', () => {
    const store = new ObservatoryStore(storage)

    const a = store.create(KYIV)
    const b = store.create(KYIV)

    expect(a.id).not.toBe(b.id)
  })

  it('updates fields without touching the id', () => {
    const store = new ObservatoryStore(storage)
    const created = store.create(KYIV)

    store.update(created.id, { name: 'Renamed', latitude: 51 })

    expect(store.byId(created.id)).toMatchObject({
      id: created.id,
      name: 'Renamed',
      latitude: 51,
      longitude: 30.52,
    })
  })

  it('ignores updates and selections for unknown ids', () => {
    const store = new ObservatoryStore(storage)
    const before = store.state

    store.update('nope', { name: 'x' })
    store.select('nope')

    expect(store.state).toEqual(before)
  })

  it('removes an observatory', () => {
    const store = new ObservatoryStore(storage)
    const created = store.create(KYIV)

    store.remove(created.id)

    expect(store.byId(created.id)).toBeUndefined()
    expect(store.all).toHaveLength(1)
  })

  it('moves the selection when the selected observatory is removed', () => {
    const store = new ObservatoryStore(storage)
    const first = store.all[0]
    const kyiv = store.create(KYIV)

    store.select(first.id)
    store.remove(first.id)

    expect(store.selected.id).toBe(kyiv.id)
  })

  it('keeps the selection when another observatory is removed', () => {
    const store = new ObservatoryStore(storage)
    const kyiv = store.create(KYIV)
    const dark = store.create(DARK_SITE)

    store.select(kyiv.id)
    store.remove(dark.id)

    expect(store.selected.id).toBe(kyiv.id)
  })

  it('recreates the default when the last observatory is removed', () => {
    const store = new ObservatoryStore(storage)

    store.remove(store.all[0].id)

    expect(store.all).toHaveLength(1)
    expect(store.selected).toMatchObject(DEFAULT_OBSERVATORY)
  })
})

describe('importObservatories', () => {
  const withId = (input: ObservatoryInput, id: string): Observatory => ({
    ...input,
    id,
  })

  it('appends new entries and leaves the selection alone', () => {
    const store = new ObservatoryStore(storage)
    const greenwich = store.all[0]

    const result = store.importObservatories(
      [withId(KYIV, 'kyiv'), withId(DARK_SITE, 'dark')],
      'append',
    )

    expect(result).toEqual({ added: 2, skipped: 0 })
    expect(store.all.map((o) => o.name)).toEqual([
      'Greenwich',
      'Kyiv balcony',
      'Dark site',
    ])
    expect(store.selected.id).toBe(greenwich.id)
  })

  it('skips appended entries whose id already exists', () => {
    const store = new ObservatoryStore(storage)
    const existing = store.all[0]

    const result = store.importObservatories(
      [withId(KYIV, existing.id), withId(DARK_SITE, 'dark')],
      'append',
    )

    expect(result).toEqual({ added: 1, skipped: 1 })
    expect(store.all.map((o) => o.id)).toEqual([existing.id, 'dark'])
    // The existing entry is untouched — the clashing import did not overwrite it.
    expect(store.byId(existing.id)).toEqual(existing)
  })

  it('replaces the whole list and selects the first on overwrite', () => {
    const store = new ObservatoryStore(storage)

    store.importObservatories(
      [withId(KYIV, 'kyiv'), withId(DARK_SITE, 'dark')],
      'overwrite',
    )

    expect(store.all.map((o) => o.id)).toEqual(['kyiv', 'dark'])
    expect(store.selected.id).toBe('kyiv')
  })

  it('persists an import so it survives a reload', () => {
    const store = new ObservatoryStore(storage)
    store.importObservatories([withId(KYIV, 'kyiv')], 'overwrite')

    const reloaded = new ObservatoryStore(storage)

    expect(reloaded.all.map((o) => o.id)).toEqual(['kyiv'])
    expect(reloaded.selected.id).toBe('kyiv')
  })

  it('ignores an empty import so the list is never emptied', () => {
    const store = new ObservatoryStore(storage)
    const before = store.state

    const result = store.importObservatories([], 'overwrite')

    expect(result).toEqual({ added: 0, skipped: 0 })
    expect(store.state).toEqual(before)
  })
})

describe('persistence', () => {
  it('survives a page reload', () => {
    const store = new ObservatoryStore(storage)
    const kyiv = store.create(KYIV)
    store.create(DARK_SITE)
    store.select(kyiv.id)

    const reloaded = new ObservatoryStore(storage)

    expect(reloaded.all).toHaveLength(3)
    expect(reloaded.selected.id).toBe(kyiv.id)
    expect(reloaded.selected).toEqual(kyiv)
  })

  it('preserves horizon text verbatim, comments and all', () => {
    const horizonText = '# treeline, measured by eye\n0 20\n\n180 5 ; shed\n'
    const store = new ObservatoryStore(storage)
    const created = store.create({ ...KYIV, horizonText })

    const reloaded = new ObservatoryStore(storage)

    expect(reloaded.byId(created.id)?.horizonText).toBe(horizonText)
  })

  it('writes under the single versioned key', () => {
    const store = new ObservatoryStore(storage)
    store.create(KYIV)

    expect([...storage.items.keys()]).toEqual([STORAGE_KEY])
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(1)
  })

  it('falls back to the default when stored JSON is corrupt', () => {
    storage.setItem(STORAGE_KEY, '{ not json')

    const store = new ObservatoryStore(storage)

    expect(store.all).toHaveLength(1)
    expect(store.selected).toMatchObject(DEFAULT_OBSERVATORY)
  })

  it('drops entries that fail validation and keeps the rest', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        selectedId: 'good',
        observatories: [
          {
            id: 'bad-lat',
            name: 'x',
            latitude: 95,
            longitude: 0,
            horizonText: '',
          },
          { id: 'no-horizon', name: 'x', latitude: 10, longitude: 0 },
          {
            id: 'good',
            name: 'Good',
            latitude: 10,
            longitude: 20,
            horizonText: '',
          },
        ],
      }),
    )

    const store = new ObservatoryStore(storage)

    expect(store.all.map((o) => o.id)).toEqual(['good'])
    expect(store.selected.id).toBe('good')
  })

  it('repairs a selectedId pointing at a missing observatory', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        selectedId: 'gone',
        observatories: [
          { id: 'a', name: 'A', latitude: 10, longitude: 20, horizonText: '' },
        ],
      }),
    )

    const store = new ObservatoryStore(storage)

    expect(store.selected.id).toBe('a')
  })

  it('keeps working when storage throws on write', () => {
    const failing: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    const store = new ObservatoryStore(failing)

    expect(() => store.create(KYIV)).not.toThrow()
    expect(store.selected.name).toBe('Kyiv balcony')
  })
})

describe('subscribe', () => {
  it('calls back immediately and on every change', () => {
    const store = new ObservatoryStore(storage)
    const seen = vi.fn()

    const unsubscribe = store.subscribe(seen)
    expect(seen).toHaveBeenCalledTimes(1)

    store.create(KYIV)
    expect(seen).toHaveBeenCalledTimes(2)
    expect(seen.mock.lastCall?.[0].observatories).toHaveLength(2)

    unsubscribe()
    store.create(DARK_SITE)
    expect(seen).toHaveBeenCalledTimes(2)
  })
})

describe('observatoryLocation', () => {
  it('extracts what the astronomy layer needs', () => {
    const store = new ObservatoryStore(storage)
    const dark = store.create(DARK_SITE)

    expect(observatoryLocation(dark)).toEqual({
      latitude: 49.1,
      longitude: 31.3,
      elevation: 220,
    })
  })
})
