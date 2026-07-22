import { describe, expect, it } from 'vitest'
import {
  objectByDesignation,
  objectById,
  searchObjects,
  allObjects,
} from './index'
import { normalize } from './search'
import type { SkyObject } from '../astro/types'

function ids(query: string, limit = 5): string[] {
  return searchObjects(query, limit).map((result) => result.object.id)
}

describe('normalize', () => {
  it('folds case, accents and punctuation', () => {
    expect(normalize("Ptolemy's Cluster")).toBe('ptolemy s cluster')
    expect(normalize('  Messier-13 ')).toBe('messier 13')
  })
})

describe('searchObjects', () => {
  it('finds an object by its Messier number, however it is typed', () => {
    for (const query of ['M13', 'm13', 'm 13', 'M-13', 'messier 13']) {
      expect(ids(query)[0], query).toBe('M13')
    }
  })

  it('finds the same object by a designation from another catalog', () => {
    expect(ids('NGC6205')[0]).toBe('M13')
    expect(ids('ngc 6205')[0]).toBe('M13')
    expect(ids('UGC454')[0]).toBe('M31')
  })

  it('finds objects by common name, including a secondary name', () => {
    expect(ids('Andromeda Galaxy')[0]).toBe('M31')
    expect(ids('orion nebula')[0]).toBe('M42')
    expect(ids('great orion')[0]).toBe('M42')
    expect(ids('pleiades')[0]).toBe('M45')
  })

  it('matches a name fragment mid-word and at a word start', () => {
    expect(ids('dumbbell')).toContain('M27')
    expect(ids('crab')).toContain('M1')
  })

  it('matches a bare catalog number', () => {
    expect(ids('6205')).toContain('M13')
  })

  it('ranks an exact designation above objects that merely contain the digits', () => {
    const results = searchObjects('M1', 10)
    expect(results[0].object.id).toBe('M1')
  })

  it('offers longer numbers as prefix matches while typing', () => {
    // "m10" is itself an object, but M100–M110 should still be reachable.
    const results = ids('m10', 12)
    expect(results[0]).toBe('M10')
    expect(results).toContain('M101')
  })

  it('finds planets by name', () => {
    expect(ids('jup')[0]).toBe('jupiter')
    expect(ids('Moon')[0]).toBe('moon')
  })

  it('matches object type, but ranks it below names', () => {
    // M13 is the "Hercules Globular Cluster": its own name carries the
    // word, so it outranks the thousands of objects merely typed GCl.
    const globular = searchObjects('globular', 3)
    expect(globular[0].object.id).toBe('M13')
    expect(globular[1].score).toBeLessThan(globular[0].score)

    // "Galaxy" is a type and part of "Andromeda Galaxy": the name wins.
    expect(ids('galaxy')[0]).toBe('M31')
  })

  it('breaks ties towards the brighter object', () => {
    const results = searchObjects('cluster', 50)
    const magnitudes = results
      .filter((result) => result.score === results[0].score)
      .map((result) =>
        'magnitude' in result.object
          ? (result.object.magnitude ?? Infinity)
          : 0,
      )
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => a - b))
  })

  it('returns nothing for an empty or unmatched query', () => {
    expect(searchObjects('')).toEqual([])
    expect(searchObjects('   ')).toEqual([])
    expect(searchObjects('zzzznope')).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchObjects('m', 7)).toHaveLength(7)
  })
})

function typeOf(object: SkyObject): string | undefined {
  return 'type' in object ? object.type : undefined
}

function magnitudeOf(object: SkyObject): number | undefined {
  return 'magnitude' in object ? object.magnitude : undefined
}

describe('catalog filters', () => {
  it('keeps only the requested object types', () => {
    const results = searchObjects('cluster', 50, {
      types: new Set(['GCl']),
    })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => typeOf(r.object) === 'GCl')).toBe(true)
  })

  it('keeps only objects at least as bright as the limit', () => {
    const results = searchObjects('', 50, { maxMagnitude: 6 })
    expect(results.length).toBeGreaterThan(0)
    for (const { object } of results) {
      const magnitude = magnitudeOf(object)
      expect(magnitude).toBeDefined()
      expect(magnitude!).toBeLessThanOrEqual(6)
    }
  })

  it('browses by filter with no query, brightest first', () => {
    const results = searchObjects('', 20, { types: new Set(['GCl']) })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => typeOf(r.object) === 'GCl')).toBe(true)
    const magnitudes = results.map((r) => magnitudeOf(r.object) ?? Infinity)
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => a - b))
  })

  it('still returns nothing for an empty query without filters', () => {
    expect(searchObjects('')).toEqual([])
    expect(searchObjects('', 20, {})).toEqual([])
  })

  it('browses everything when browse is forced, even with no filters', () => {
    // The pool a downstream (observability) filter draws from: the whole
    // catalog, not the empty result an unforced empty query gives.
    expect(searchObjects('', 5, undefined, true)).toHaveLength(5)
    expect(searchObjects('', 5, undefined, false)).toEqual([])
  })

  it('narrows a text query by type', () => {
    const results = searchObjects('nebula', 50, { types: new Set(['PN']) })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => typeOf(r.object) === 'PN')).toBe(true)
  })
})

describe('lookup', () => {
  it('resolves ids for both kinds of object', () => {
    expect(objectById('M13')?.name).toBe('Hercules Globular Cluster')
    expect(objectById('saturn')?.kind).toBe('planet')
    expect(objectById('nope')).toBeUndefined()
  })

  it('resolves any designation to the object', () => {
    expect(objectByDesignation('ngc 6205')?.id).toBe('M13')
    expect(objectByDesignation('M13')?.id).toBe('M13')
    expect(objectByDesignation('M102')?.id).toBe('M102')
    expect(objectByDesignation('NGC5866')?.id).toBe('M102')
    expect(objectByDesignation('orion')).toBeUndefined()
  })

  it('has unique ids across the whole catalog', () => {
    const seen = new Set(allObjects.map((object) => object.id))
    expect(seen.size).toBe(allObjects.length)
  })
})
