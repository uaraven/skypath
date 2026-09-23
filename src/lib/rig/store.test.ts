import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RigStore, selectedRig, STORAGE_KEY } from './store'
import { MemoryStorage, type KeyValueStore } from '../storage'
import type { Rig, RigInput } from './types'

const NEWTONIAN: RigInput = {
  name: 'Widefield newt',
  telescope: { focalLength: 530, aperture: 130 },
  camera: { pixelsX: 6252, pixelsY: 4176, pitchX: 3.76, pitchY: 3.76 },
}

const REFRACTOR: RigInput = {
  name: 'Small refractor',
  telescope: { focalLength: 480 },
  camera: {
    sensorId: 'imx533',
    pixelsX: 3008,
    pixelsY: 3008,
    pitchX: 3.76,
    pitchY: 3.76,
  },
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
})

describe('selectedRig', () => {
  const a: Rig = { ...NEWTONIAN, id: 'a' }
  const b: Rig = { ...REFRACTOR, id: 'b' }

  it('returns the entry matching selectedId', () => {
    expect(selectedRig({ rigs: [a, b], selectedId: 'b' })).toBe(b)
  })

  it('returns null when nothing is selected', () => {
    expect(selectedRig({ rigs: [a, b], selectedId: null })).toBeNull()
  })

  it('returns null when selectedId dangles', () => {
    expect(selectedRig({ rigs: [a, b], selectedId: 'gone' })).toBeNull()
  })
})

describe('first launch', () => {
  it('starts with an empty list and nothing selected', () => {
    const store = new RigStore(storage)

    expect(store.all).toEqual([])
    expect(store.selected).toBeNull()
  })

  it('works with no storage at all', () => {
    const store = new RigStore(null)

    store.create(NEWTONIAN)
    expect(store.selected?.name).toBe('Widefield newt')
  })
})

describe('CRUD', () => {
  it('creates a rig and selects it', () => {
    const store = new RigStore(storage)

    const created = store.create(NEWTONIAN)

    expect(store.all).toHaveLength(1)
    expect(store.selected?.id).toBe(created.id)
    expect(store.selected?.name).toBe('Widefield newt')
  })

  it('gives each rig a distinct id', () => {
    const store = new RigStore(storage)

    const a = store.create(NEWTONIAN)
    const b = store.create(NEWTONIAN)

    expect(a.id).not.toBe(b.id)
  })

  it('updates fields without touching the id', () => {
    const store = new RigStore(storage)
    const created = store.create(NEWTONIAN)

    store.update(created.id, { name: 'Renamed' })

    expect(store.byId(created.id)).toMatchObject({
      id: created.id,
      name: 'Renamed',
      telescope: NEWTONIAN.telescope,
    })
  })

  it('ignores updates and selections for unknown ids', () => {
    const store = new RigStore(storage)
    const before = store.state

    store.update('nope', { name: 'x' })
    store.select('nope')

    expect(store.state).toEqual(before)
  })

  it('removes a rig', () => {
    const store = new RigStore(storage)
    const created = store.create(NEWTONIAN)

    store.remove(created.id)

    expect(store.byId(created.id)).toBeUndefined()
    expect(store.all).toEqual([])
  })

  it('leaves the list empty and selection null when the last rig is removed', () => {
    const store = new RigStore(storage)
    const created = store.create(NEWTONIAN)

    store.remove(created.id)

    expect(store.all).toEqual([])
    expect(store.selected).toBeNull()
  })

  it('moves the selection when the selected rig is removed', () => {
    const store = new RigStore(storage)
    const first = store.create(NEWTONIAN)
    const second = store.create(REFRACTOR)

    store.select(first.id)
    store.remove(first.id)

    expect(store.selected?.id).toBe(second.id)
  })

  it('keeps the selection when another rig is removed', () => {
    const store = new RigStore(storage)
    const first = store.create(NEWTONIAN)
    const second = store.create(REFRACTOR)

    store.select(first.id)
    store.remove(second.id)

    expect(store.selected?.id).toBe(first.id)
  })
})

describe('select / deselect', () => {
  it('deselects without removing anything', () => {
    const store = new RigStore(storage)
    store.create(NEWTONIAN)

    store.deselect()

    expect(store.all).toHaveLength(1)
    expect(store.selected).toBeNull()
  })
})

describe('reorder', () => {
  it('moves an entry before its target', () => {
    const store = new RigStore(storage)
    const a = store.create(NEWTONIAN)
    const b = store.create(REFRACTOR)

    store.reorder(b.id, a.id, 'before')

    expect(store.all.map((r) => r.id)).toEqual([b.id, a.id])
  })

  it('moves an entry after its target', () => {
    const store = new RigStore(storage)
    const a = store.create(NEWTONIAN)
    const b = store.create(REFRACTOR)

    store.reorder(a.id, b.id, 'after')

    expect(store.all.map((r) => r.id)).toEqual([b.id, a.id])
  })

  it('is a no-op for unknown ids or moving an entry relative to itself', () => {
    const store = new RigStore(storage)
    const a = store.create(NEWTONIAN)
    const before = store.state

    store.reorder(a.id, a.id, 'before')
    store.reorder('nope', a.id, 'before')
    store.reorder(a.id, 'nope', 'before')

    expect(store.state).toEqual(before)
  })
})

describe('importRigs', () => {
  const withId = (input: RigInput, id: string): Rig => ({ ...input, id })

  it('appends new entries and leaves the selection alone', () => {
    const store = new RigStore(storage)
    const existing = store.create(NEWTONIAN)

    const result = store.importRigs([withId(REFRACTOR, 'imported')], 'append')

    expect(result).toEqual({ added: 1, skipped: 0 })
    expect(store.all.map((r) => r.id)).toEqual([existing.id, 'imported'])
    expect(store.selected?.id).toBe(existing.id)
  })

  it('skips appended entries whose id already exists', () => {
    const store = new RigStore(storage)
    const existing = store.create(NEWTONIAN)

    const result = store.importRigs(
      [withId(REFRACTOR, existing.id), withId(REFRACTOR, 'new')],
      'append',
    )

    expect(result).toEqual({ added: 1, skipped: 1 })
    expect(store.all.map((r) => r.id)).toEqual([existing.id, 'new'])
    expect(store.byId(existing.id)).toEqual(existing)
  })

  it('replaces the whole list and selects the first on overwrite', () => {
    const store = new RigStore(storage)
    store.create(NEWTONIAN)

    store.importRigs(
      [withId(REFRACTOR, 'a'), withId(NEWTONIAN, 'b')],
      'overwrite',
    )

    expect(store.all.map((r) => r.id)).toEqual(['a', 'b'])
    expect(store.selected?.id).toBe('a')
  })

  it('an empty overwrite is legal and leaves the list empty with nothing selected', () => {
    const store = new RigStore(storage)
    store.create(NEWTONIAN)

    const result = store.importRigs([], 'overwrite')

    expect(result).toEqual({ added: 0, skipped: 0 })
    expect(store.all).toEqual([])
    expect(store.selected).toBeNull()
  })

  it('an empty append is a no-op', () => {
    const store = new RigStore(storage)
    const before = store.state

    const result = store.importRigs([], 'append')

    expect(result).toEqual({ added: 0, skipped: 0 })
    expect(store.state).toEqual(before)
  })
})

describe('persistence', () => {
  it('survives a page reload', () => {
    const store = new RigStore(storage)
    const a = store.create(NEWTONIAN)
    store.create(REFRACTOR)
    store.select(a.id)

    const reloaded = new RigStore(storage)

    expect(reloaded.all).toHaveLength(2)
    expect(reloaded.selected?.id).toBe(a.id)
    expect(reloaded.selected).toEqual(a)
  })

  it('persists an empty list, not a fabricated default', () => {
    const store = new RigStore(storage)
    store.create(NEWTONIAN)
    store.remove(store.all[0].id)

    const reloaded = new RigStore(storage)

    expect(reloaded.all).toEqual([])
    expect(reloaded.selected).toBeNull()
  })

  it('writes under the single versioned key', () => {
    const store = new RigStore(storage)
    store.create(NEWTONIAN)

    expect([...storage.items.keys()]).toEqual([STORAGE_KEY])
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(1)
  })

  it('falls back to empty when stored JSON is corrupt', () => {
    storage.setItem(STORAGE_KEY, '{ not json')

    const store = new RigStore(storage)

    expect(store.all).toEqual([])
    expect(store.selected).toBeNull()
  })

  it('drops entries that fail validation and keeps the rest', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        selectedId: 'good',
        rigs: [
          { id: 'bad-telescope', name: 'x', telescope: {}, camera: {} },
          {
            id: 'good',
            name: 'Good',
            telescope: { focalLength: 500 },
            camera: { pixelsX: 100, pixelsY: 100, pitchX: 4, pitchY: 4 },
          },
        ],
      }),
    )

    const store = new RigStore(storage)

    expect(store.all.map((r) => r.id)).toEqual(['good'])
    expect(store.selected?.id).toBe('good')
  })

  it('a stored rig failing isRig is dropped, not fatal to boot', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, selectedId: null, rigs: [{ id: 'x' }] }),
    )

    expect(() => new RigStore(storage)).not.toThrow()
    const store = new RigStore(storage)
    expect(store.all).toEqual([])
  })

  it('repairs a selectedId pointing at a missing rig', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        selectedId: 'gone',
        rigs: [
          {
            id: 'a',
            name: 'A',
            telescope: { focalLength: 500 },
            camera: { pixelsX: 100, pixelsY: 100, pitchX: 4, pitchY: 4 },
          },
        ],
      }),
    )

    const store = new RigStore(storage)

    expect(store.selected).toBeNull()
  })

  it('keeps working when storage throws on write', () => {
    const failing: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    const store = new RigStore(failing)

    expect(() => store.create(NEWTONIAN)).not.toThrow()
    expect(store.selected?.name).toBe('Widefield newt')
  })
})

describe('subscribe', () => {
  it('calls back immediately and on every change', () => {
    const store = new RigStore(storage)
    const seen = vi.fn()

    const unsubscribe = store.subscribe(seen)
    expect(seen).toHaveBeenCalledTimes(1)

    store.create(NEWTONIAN)
    expect(seen).toHaveBeenCalledTimes(2)
    expect(seen.mock.lastCall?.[0].rigs).toHaveLength(1)

    unsubscribe()
    store.create(REFRACTOR)
    expect(seen).toHaveBeenCalledTimes(2)
  })
})
