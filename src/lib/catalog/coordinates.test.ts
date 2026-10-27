import { describe, expect, it } from 'vitest'
import { objectById } from './index'
import {
  coordinateObject,
  coordinateObjectById,
  parseCoordinateQuery,
} from './coordinates'

describe('parseCoordinateQuery', () => {
  it('reads hours/degrees, minutes and seconds', () => {
    const p = parseCoordinateQuery('RA 05 35 17 DEC -05 23 28')!
    expect(p.ra).toBeCloseTo(5 + 35 / 60 + 17 / 3600, 9)
    expect(p.dec).toBeCloseTo(-(5 + 23 / 60 + 28 / 3600), 9)
  })

  it('takes decimal seconds, with any number of places', () => {
    const p = parseCoordinateQuery('ra 5 35 17.30 dec +5 23 28.123456')!
    expect(p.ra).toBeCloseTo(5 + 35 / 60 + 17.3 / 3600, 9)
    expect(p.dec).toBeCloseTo(5 + 23 / 60 + 28.123456 / 3600, 9)
  })

  it('treats omitted seconds as zero', () => {
    const p = parseCoordinateQuery('RA 05 35 DEC -05 23')!
    expect(p.ra).toBeCloseTo(5 + 35 / 60, 9)
    expect(p.dec).toBeCloseTo(-(5 + 23 / 60), 9)
    expect(p).toEqual(parseCoordinateQuery('RA 05 35 00 DEC -05 23 00'))
  })

  it('ignores case and extra whitespace', () => {
    expect(parseCoordinateQuery('  Ra  1 2 3   DeC  4 5 6 ')).not.toBeNull()
  })

  it('accepts unit markers and colons', () => {
    const a = parseCoordinateQuery('RA 05h35m17.3s DEC -05°23′28″')
    const b = parseCoordinateQuery('RA 05:35:17.3 DEC -05:23:28')
    expect(a).toEqual(b)
    expect(a).not.toBeNull()
  })

  it('keeps the sign of a declination whose degrees are zero', () => {
    expect(parseCoordinateQuery('RA 1 0 0 DEC -00 30 00')!.dec).toBeCloseTo(
      -0.5,
    )
  })

  it.each([
    'M31',
    'RA 05 35 17',
    'RA 5 DEC 1',
    'RA 5 0 0 0 DEC 1 2 3',
    'RA 24 00 00 DEC 0 0 0',
    'RA 25 00 00 DEC 0 0 0',
    'RA 5 60 0 DEC 0 0 0',
    'RA 5 0 60 DEC 0 0 0',
    'RA 5 0 0 DEC 91 0 0',
    'RA 5 0 0 DEC 90 0 1',
    'RA 5 0 0 DEC x y z',
  ])('rejects %j', (text) => {
    expect(parseCoordinateQuery(text)).toBeNull()
  })
})

describe('coordinate targets', () => {
  it('round-trips through their id', () => {
    const object = coordinateObject(5.588, -5.391)
    const again = coordinateObjectById(object.id)!
    expect(again.ra).toBeCloseTo(5.588, 6)
    expect(again.dec).toBeCloseTo(-5.391, 6)
  })

  it('is restored by objectById', () => {
    const object = coordinateObject(12.5, 45)
    expect(objectById(object.id)?.kind).toBe('deep-sky')
  })

  it('rejects malformed ids', () => {
    expect(coordinateObjectById('RADEC:abc,1')).toBeUndefined()
    expect(coordinateObjectById('RADEC:30,1')).toBeUndefined()
    expect(coordinateObjectById('M31')).toBeUndefined()
  })
})
