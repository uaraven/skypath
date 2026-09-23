import { describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup, type BackupFile } from './backup'
import type { Observatory } from '../observatory/types'
import type { Rig } from '../rig/types'

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

const NEWTONIAN: Rig = {
  id: 'r1',
  name: 'Widefield newt',
  telescope: { focalLength: 530, aperture: 130 },
  camera: { pixelsX: 6252, pixelsY: 4176, pitchX: 3.76, pitchY: 3.76 },
}

const REFRACTOR: Rig = {
  id: 'r2',
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

describe('serializeBackup', () => {
  it('writes a tagged, versioned envelope with both collections', () => {
    const parsed = JSON.parse(
      serializeBackup([GREENWICH], [NEWTONIAN]),
    ) as BackupFile

    expect(parsed.app).toBe('skypath')
    expect(parsed.kind).toBe('backup')
    expect(parsed.version).toBe(2)
    expect(typeof parsed.exportedAt).toBe('string')
    expect(parsed.observatories).toEqual([GREENWICH])
    expect(parsed.rigs).toEqual([NEWTONIAN])
  })

  it('does not carry a selectedId for either collection', () => {
    const parsed = JSON.parse(serializeBackup([GREENWICH], [NEWTONIAN]))

    expect(parsed).not.toHaveProperty('selectedId')
  })
})

describe('round trip', () => {
  it('preserves every field of both collections', () => {
    const result = parseBackup(
      serializeBackup([GREENWICH, DARK_SITE], [NEWTONIAN, REFRACTOR]),
    )

    expect(result.error).toBeUndefined()
    expect(result.invalidObservatories).toBe(0)
    expect(result.invalidRigs).toBe(0)
    expect(result.observatories).toEqual([GREENWICH, DARK_SITE])
    expect(result.rigs).toEqual([NEWTONIAN, REFRACTOR])
  })

  it('round-trips with one collection empty', () => {
    const result = parseBackup(serializeBackup([GREENWICH], []))

    expect(result.observatories).toEqual([GREENWICH])
    expect(result.rigs).toEqual([])
  })
})

describe('v1 compatibility', () => {
  it('imports a v1 observatory-only envelope with no rigs array', () => {
    const v1 = JSON.stringify({
      app: 'skypath',
      kind: 'observatories',
      version: 1,
      exportedAt: '2024-01-01T00:00:00.000Z',
      observatories: [GREENWICH],
    })

    const result = parseBackup(v1)

    expect(result.observatories).toEqual([GREENWICH])
    expect(result.rigs).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('imports a bare array of observatories', () => {
    const result = parseBackup(JSON.stringify([GREENWICH]))

    expect(result.observatories).toEqual([GREENWICH])
    expect(result.rigs).toEqual([])
  })
})

describe('rejecting bad input', () => {
  it('flags JSON that will not parse', () => {
    const result = parseBackup('{ not json')

    expect(result.observatories).toEqual([])
    expect(result.rigs).toEqual([])
    expect(result.error).toMatch(/json/i)
  })

  it('flags a file with neither an observatories nor a rigs array', () => {
    const result = parseBackup(JSON.stringify({ hello: 'world' }))

    expect(result.error).toMatch(/no observatories or rigs/i)
  })

  it('drops invalid entries from each collection and counts them', () => {
    const mixed = JSON.stringify({
      observatories: [GREENWICH, { id: 'x', name: 'No coords' }],
      rigs: [NEWTONIAN, { id: 'y', name: 'No telescope' }],
    })

    const result = parseBackup(mixed)

    expect(result.observatories).toEqual([GREENWICH])
    expect(result.invalidObservatories).toBe(1)
    expect(result.rigs).toEqual([NEWTONIAN])
    expect(result.invalidRigs).toBe(1)
  })

  it('keeps only the first of entries sharing an id, per collection', () => {
    const dupRig = { ...REFRACTOR, id: NEWTONIAN.id, name: 'Clash' }
    const result = parseBackup(
      JSON.stringify({ observatories: [], rigs: [NEWTONIAN, dupRig] }),
    )

    expect(result.rigs).toEqual([NEWTONIAN])
    expect(result.invalidRigs).toBe(0)
  })
})
