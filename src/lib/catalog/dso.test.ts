import { describe, expect, it } from 'vitest'
import { trajectoryForDate } from '../astro/trajectory'
import type { GeoLocation } from '../astro/types'
import { buildCatalog, deepSkyObjects } from './dso'
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

describe('bundled Messier catalog', () => {
  it('covers every Messier number', () => {
    const numbers = new Set(
      deepSkyObjects.flatMap((object) =>
        object.designations
          .filter((designation) => designation.catalog === 'M')
          .map((designation) => Number(designation.number)),
      ),
    )
    for (let n = 1; n <= 110; n++) {
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

  it('resolves every object to a valid trajectory', () => {
    const date = new Date('2026-10-15T12:00:00Z')
    for (const object of deepSkyObjects) {
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
