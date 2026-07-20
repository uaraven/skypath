import { describe, expect, it } from 'vitest'
import {
  parseObservatoryImport,
  serializeObservatories,
  type ObservatoryExport,
} from './transfer'
import type { Observatory } from './types'

const GREENWICH: Observatory = {
  id: 'a',
  name: 'Greenwich',
  latitude: 51.4779,
  longitude: -0.0015,
  elevation: 47,
  horizonText: '',
}

const DARK_SITE: Observatory = {
  id: 'b',
  name: 'Dark site',
  latitude: 49.1,
  longitude: 31.3,
  horizonText: '# ridge to the east\n0 20\n90 12\n180 5',
}

describe('serializeObservatories', () => {
  it('writes a tagged, versioned envelope', () => {
    const parsed = JSON.parse(
      serializeObservatories([GREENWICH]),
    ) as ObservatoryExport

    expect(parsed.app).toBe('skypath')
    expect(parsed.kind).toBe('observatories')
    expect(parsed.version).toBe(1)
    expect(typeof parsed.exportedAt).toBe('string')
    expect(parsed.observatories).toEqual([GREENWICH])
  })

  it('does not carry a selectedId', () => {
    const parsed = JSON.parse(serializeObservatories([GREENWICH]))

    expect(parsed).not.toHaveProperty('selectedId')
  })
})

describe('round trip', () => {
  it('preserves every field, horizon text included', () => {
    const result = parseObservatoryImport(
      serializeObservatories([GREENWICH, DARK_SITE]),
    )

    expect(result.error).toBeUndefined()
    expect(result.invalid).toBe(0)
    expect(result.observatories).toEqual([GREENWICH, DARK_SITE])
  })
})

describe('accepted containers', () => {
  it('reads a bare array of observatories', () => {
    const result = parseObservatoryImport(JSON.stringify([GREENWICH]))

    expect(result.observatories).toEqual([GREENWICH])
  })

  it('reads the localStorage {observatories} shape', () => {
    const onDisk = JSON.stringify({
      version: 1,
      observatories: [GREENWICH],
      selectedId: 'a',
    })

    expect(parseObservatoryImport(onDisk).observatories).toEqual([GREENWICH])
  })
})

describe('rejecting bad input', () => {
  it('flags JSON that will not parse', () => {
    const result = parseObservatoryImport('{ not json')

    expect(result.observatories).toEqual([])
    expect(result.error).toMatch(/json/i)
  })

  it('flags a file with no observatories array', () => {
    const result = parseObservatoryImport(JSON.stringify({ hello: 'world' }))

    expect(result.observatories).toEqual([])
    expect(result.error).toMatch(/no observatories/i)
  })

  it('drops invalid entries and counts them', () => {
    const mixed = JSON.stringify({
      observatories: [
        GREENWICH,
        { id: 'x', name: 'No coords' },
        { name: 'No id', latitude: 10, longitude: 10, horizonText: '' },
      ],
    })

    const result = parseObservatoryImport(mixed)

    expect(result.observatories).toEqual([GREENWICH])
    expect(result.invalid).toBe(2)
  })

  it('keeps only the first of entries sharing an id', () => {
    const dup = { ...DARK_SITE, id: GREENWICH.id, name: 'Clash' }
    const result = parseObservatoryImport(
      JSON.stringify({ observatories: [GREENWICH, dup] }),
    )

    expect(result.observatories).toEqual([GREENWICH])
    expect(result.invalid).toBe(0)
  })
})
