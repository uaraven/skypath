import { describe, expect, it } from 'vitest'
import { trajectoryForDate } from '../astro/trajectory'
import type { GeoLocation } from '../astro/types'
import { buildCatalog, catalogSources, deepSkyObjects } from './dso'
import type { CatalogFile } from './types'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }

function find(id: string) {
  const object = deepSkyObjects.find((candidate) => candidate.id === id)
  if (!object) throw new Error(`${id} missing from the catalog`)
  return object
}

function designations(id: string): string[] {
  return find(id).designations.map((d) => `${d.catalog}${d.number}`)
}

describe('bundled deep-sky catalog', () => {
  it('covers every Messier number', () => {
    const numbers = new Set(
      deepSkyObjects.flatMap((object) =>
        object.designations
          .filter((designation) => designation.catalog === 'M')
          .map((designation) => Number(designation.number)),
      ),
    )
    for (let n = 1; n <= 110; n++) {
      // M40 (Winnecke 4) is a double star, dropped along with the other stars,
      // so it is deliberately absent — every other Messier number is present.
      if (n === 40) {
        expect(numbers, 'M40').not.toContain(40)
        continue
      }
      expect(numbers, `M${n}`).toContain(n)
    }
  })

  it('has coordinates in range and a type for every object', () => {
    for (const object of deepSkyObjects) {
      expect(object.ra, object.id).toBeGreaterThanOrEqual(0)
      expect(object.ra, object.id).toBeLessThan(24)
      expect(Math.abs(object.dec), object.id).toBeLessThanOrEqual(90)
      expect(object.type, object.id).toBeTruthy()
      expect(object.kind).toBe('deep-sky')
    }
  })

  it('matches published positions', () => {
    // J2000, from SIMBAD/OpenNGC; a tenth of a degree is far tighter than any
    // plotting need but catches a units or parsing slip.
    const m13 = find('M13')
    expect(m13.ra).toBeCloseTo(16.6949, 3)
    expect(m13.dec).toBeCloseTo(36.4613, 3)

    const m42 = find('M42')
    expect(m42.ra).toBeCloseTo(5.5879, 3)
    expect(m42.dec).toBeCloseTo(-5.3897, 3)
  })

  it('carries cross-catalog designations', () => {
    expect(designations('M13')).toContain('NGC6205')
    expect(designations('M31')).toEqual(
      expect.arrayContaining(['NGC224', 'UGC454', 'PGC2557']),
    )
    // M45 is in no NGC-family catalog; Melotte is the designation it has.
    expect(designations('M45')).toContain('Mel22')
  })

  it('resolves the disputed M102 as NGC 5866, distinct from M101', () => {
    const m102 = find('M102')
    expect(designations('M102')).toContain('NGC5866')
    expect(m102.constellation).toBe('Dra')
    expect(m102.ra).toBeCloseTo(15.1082, 3)
    expect(m102.dec).toBeCloseTo(55.7632, 3)

    // The other reading makes M102 an alias of M101. It is not one here, and
    // the two sit 12° apart, so nothing should carry both numbers.
    expect(designations('M101')).not.toContain('M102')
    expect(find('M101').id).not.toBe(m102.id)
  })

  it('names objects by common name where there is one, else by designation', () => {
    expect(find('M42').name).toBe('Great Orion Nebula')
    expect(find('M42').names).toContain('Orion Nebula')
    expect(find('M2').name).toBe('M2')
  })

  /**
   * Sampled rather than exhaustive: a trajectory per object is ~25 ephemeris
   * solutions, which at catalog scale runs for minutes. The coordinates of
   * every object are checked above; this covers the step from coordinates to
   * a plotted path, and the stride crosses all five data files.
   */
  it('resolves sampled objects across every catalog to a valid trajectory', () => {
    const date = new Date('2026-10-15T12:00:00Z')
    const sample = deepSkyObjects.filter((_, i) => i % 97 === 0)
    expect(sample.length).toBeGreaterThan(100)

    for (const object of sample) {
      const { points } = trajectoryForDate(object, KYIV, date, 60)
      expect(points.length, object.id).toBeGreaterThan(0)
      for (const point of points) {
        expect(Number.isFinite(point.altitude), object.id).toBe(true)
        expect(Math.abs(point.altitude), object.id).toBeLessThanOrEqual(90)
        expect(point.azimuth, object.id).toBeGreaterThanOrEqual(0)
        expect(point.azimuth, object.id).toBeLessThan(360)
      }
    }
  })

  it('merges NGC entries into the Messier objects they are', () => {
    // The whole point of merging by designation: M13 and NGC 6205 are one
    // object with two numbers, not two rows in the results.
    expect(find('M13').designations[0]).toEqual({ catalog: 'M', number: '13' })
    expect(deepSkyObjects.filter((o) => o.id === 'NGC6205')).toHaveLength(0)
    expect(find('M13').names).toContain('Hercules Globular Cluster')
  })

  it('keeps designations of objects OpenNGC catalogued twice', () => {
    // IC 11 is a re-observation of NGC 281; the stub row is dropped but the
    // number stays searchable on the surviving object.
    expect(designations('NGC281')).toContain('IC11')
    // NGC 755's own row does not mention NGC 763 — only the duplicate's does.
    expect(designations('NGC755')).toContain('NGC763')
  })

  it('carries the VizieR-derived nebula catalogs', () => {
    const cave = find('Sh2-155')
    expect(cave.type).toBe('HII')
    expect(cave.constellation).toBe('Cep')
    // J2000, precessed by VizieR from the catalogue's B1900 positions.
    expect(cave.ra).toBeCloseTo(22.9455, 3)
    expect(cave.dec).toBeCloseTo(62.6177, 3)

    const ldn = find('LDN1622')
    expect(ldn.type).toBe('DrkN')
    expect(ldn.magnitude).toBeUndefined()
  })

  it('attributes every bundled source', () => {
    expect(catalogSources).toHaveLength(3)
    expect(catalogSources.some((s) => s.includes('OpenNGC'))).toBe(true)
    expect(catalogSources.some((s) => s.includes('Sharpless'))).toBe(true)
    expect(catalogSources.some((s) => s.includes('Lynds'))).toBe(true)
    // CC-BY-SA-4.0 makes the OpenNGC line a licence obligation, not a nicety.
    expect(catalogSources.some((s) => s.includes('CC-BY-SA-4.0'))).toBe(true)
  })

  it('covers each bundled catalog', () => {
    const primary = (id: string) =>
      deepSkyObjects.filter((object) => object.designations[0].catalog === id)
        .length

    // Objects in more than one catalog are filed under the earliest, so NGC
    // is short its ~40 Messier entries and IC short those it shares with NGC.
    // 109, not 110: M40 is a double star and dropped on import.
    expect(primary('M')).toBe(109)
    expect(primary('NGC')).toBeGreaterThan(7000)
    expect(primary('IC')).toBeGreaterThan(4000)
    expect(primary('Sh2')).toBe(313)
    expect(primary('LDN')).toBe(1787)
  })
})

describe('buildCatalog', () => {
  const file = (
    catalog: string,
    objects: CatalogFile['objects'],
  ): CatalogFile => ({
    catalog,
    title: catalog,
    source: 'test',
    objects,
  })

  it('merges entries from different files that share a designation', () => {
    const objects = buildCatalog([
      file('M', [
        {
          id: 'M42',
          designations: ['M42', 'NGC1976'],
          names: ['Orion Nebula'],
          ra: 5.5879,
          dec: -5.3897,
          type: 'Cl+N',
        },
      ]),
      file('NGC', [
        {
          id: 'NGC1976',
          designations: ['NGC1976', 'LBN974'],
          names: ['Great Orion Nebula'],
          ra: 5.5879,
          dec: -5.3897,
          magnitude: 4,
        },
      ]),
    ])

    expect(objects).toHaveLength(1)
    expect(objects[0].id).toBe('M42')
    expect(objects[0].designations.map((d) => d.catalog)).toEqual([
      'M',
      'NGC',
      'LBN',
    ])
    expect(objects[0].names).toEqual(['Orion Nebula', 'Great Orion Nebula'])
    // The first file wins on coordinates; the second fills gaps it left.
    expect(objects[0].type).toBe('Cl+N')
    expect(objects[0].magnitude).toBe(4)
  })

  it('keeps unrelated objects separate', () => {
    const objects = buildCatalog([
      file('NGC', [
        { id: 'NGC1', designations: ['NGC1'], names: [], ra: 0.1, dec: 27.7 },
        { id: 'NGC2', designations: ['NGC2'], names: [], ra: 0.2, dec: 27.6 },
      ]),
    ])
    expect(objects).toHaveLength(2)
  })

  it('rejects an entry whose catalog is not registered', () => {
    expect(() =>
      buildCatalog([
        file('X', [
          { id: 'X1', designations: ['XYZ1'], names: [], ra: 1, dec: 1 },
        ]),
      ]),
    ).toThrow(/no parseable designation/)
  })
})
