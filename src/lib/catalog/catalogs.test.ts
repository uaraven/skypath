import { describe, expect, it } from 'vitest'
import {
  CATALOGS,
  designationKey,
  formatDesignation,
  parseDesignation,
  telescopiusUrl,
  typeLabel,
} from './catalogs'

describe('parseDesignation', () => {
  it('accepts the spellings a data file or a user may produce', () => {
    for (const text of ['NGC1952', 'NGC 1952', 'ngc-1952', ' ngc 1952 ']) {
      expect(parseDesignation(text)).toEqual({ catalog: 'NGC', number: '1952' })
    }
  })

  it('strips the zero padding source catalogs use', () => {
    expect(parseDesignation('M007')).toEqual({ catalog: 'M', number: '7' })
  })

  it('accepts full catalog names as aliases', () => {
    expect(parseDesignation('messier 13')).toEqual({
      catalog: 'M',
      number: '13',
    })
  })

  it('keeps letter suffixes', () => {
    expect(parseDesignation('NGC4a')).toEqual({ catalog: 'NGC', number: '4a' })
  })

  it('reads Caldwell without mistaking it for Collinder', () => {
    for (const text of ['C14', 'c 14', 'caldwell14']) {
      expect(parseDesignation(text)).toEqual({ catalog: 'C', number: '14' })
    }
    // The one-letter `C` prefix must not swallow the longer `Cr` prefix.
    expect(parseDesignation('Cr50')).toEqual({ catalog: 'Cr', number: '50' })
  })

  it('rejects unregistered prefixes and non-designations', () => {
    expect(parseDesignation('XYZ42')).toBeNull()
    expect(parseDesignation('orion')).toBeNull()
    expect(parseDesignation('42')).toBeNull()
    expect(parseDesignation('')).toBeNull()
  })

  it('round-trips through the registry formatting', () => {
    expect(formatDesignation(parseDesignation('m13')!)).toBe('M13')
    expect(formatDesignation(parseDesignation('ngc6205')!)).toBe('NGC 6205')
  })

  it('gives the same key regardless of spelling', () => {
    const keys = ['M13', 'm 13', 'messier13'].map((text) =>
      designationKey(parseDesignation(text)!),
    )
    expect(new Set(keys).size).toBe(1)
  })
})

describe('registry', () => {
  it('has unique catalog ids', () => {
    const ids = CATALOGS.map((catalog) => catalog.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no alias that collides with another catalog id', () => {
    const ids = new Set(CATALOGS.map((catalog) => catalog.id.toLowerCase()))
    for (const catalog of CATALOGS) {
      for (const alias of catalog.aliases ?? []) {
        expect(ids.has(alias)).toBe(false)
      }
    }
  })

  it('labels known types and passes unknown ones through', () => {
    expect(typeLabel('GCl')).toBe('Globular cluster')
    expect(typeLabel('Wat')).toBe('Wat')
    expect(typeLabel(undefined)).toBeUndefined()
  })
})

describe('telescopiusUrl', () => {
  it('builds a URL for the catalogs Telescopius indexes', () => {
    expect(telescopiusUrl([{ catalog: 'M', number: '31' }])).toBe(
      'https://telescopius.com/deep-sky-objects/m31',
    )
    expect(telescopiusUrl([{ catalog: 'NGC', number: '6205' }])).toBe(
      'https://telescopius.com/deep-sky-objects/ngc6205',
    )
    expect(telescopiusUrl([{ catalog: 'IC', number: '434' }])).toBe(
      'https://telescopius.com/deep-sky-objects/ic434',
    )
    expect(telescopiusUrl([{ catalog: 'C', number: '14' }])).toBe(
      'https://telescopius.com/deep-sky-objects/c14',
    )
  })

  it('keeps the hyphen Sharpless 2 needs, unlike the space-separated catalogs', () => {
    expect(telescopiusUrl([{ catalog: 'Sh2', number: '155' }])).toBe(
      'https://telescopius.com/deep-sky-objects/sh2-155',
    )
  })

  it('picks the first designation in a catalog Telescopius indexes', () => {
    expect(
      telescopiusUrl([
        { catalog: 'Mel', number: '20' },
        { catalog: 'NGC', number: '1952' },
      ]),
    ).toBe('https://telescopius.com/deep-sky-objects/ngc1952')
  })

  it('builds a URL for LDN and LBN, the same as the space-separated catalogs', () => {
    expect(telescopiusUrl([{ catalog: 'LDN', number: '1622' }])).toBe(
      'https://telescopius.com/deep-sky-objects/ldn1622',
    )
    expect(telescopiusUrl([{ catalog: 'LBN', number: '974' }])).toBe(
      'https://telescopius.com/deep-sky-objects/lbn974',
    )
  })

  it('returns null when no designation is in a catalog Telescopius indexes', () => {
    expect(
      telescopiusUrl([
        { catalog: 'Mel', number: '20' },
        { catalog: 'UGC', number: '454' },
      ]),
    ).toBeNull()
    expect(telescopiusUrl([])).toBeNull()
  })
})
