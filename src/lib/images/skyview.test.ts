import { describe, expect, it } from 'vitest'
import type { DeepSkyObject } from '../astro/types'
import { objectByDesignation } from '../catalog'
import {
  DEFAULT_FIELD_ARCMIN,
  FRAMING_FACTOR,
  MAX_FIELD_DEGREES,
  MIN_FIELD_DEGREES,
  skyViewFieldDegrees,
  skyViewUrl,
} from './skyview'

function object(overrides: Partial<DeepSkyObject> = {}): DeepSkyObject {
  return {
    id: 'test',
    name: 'Test object',
    kind: 'deep-sky',
    ra: 1,
    dec: 2,
    ...overrides,
  }
}

const params = (url: string) => new URL(url).searchParams

describe('field of view', () => {
  it('frames the object with sky around it', () => {
    expect(skyViewFieldDegrees(60)).toBeCloseTo(FRAMING_FACTOR, 6)
  })

  it('falls back to 30 arcminutes when the catalog gives no size', () => {
    expect(skyViewFieldDegrees(undefined)).toBeCloseTo(
      (DEFAULT_FIELD_ARCMIN * FRAMING_FACTOR) / 60,
      6,
    )
    // A zero size is a missing size, not a point source.
    expect(skyViewFieldDegrees(0)).toBe(skyViewFieldDegrees(undefined))
  })

  it('clamps a degree-scale object to a readable frame', () => {
    // The Veil is several degrees across; a 1:1 cutout would be slow and flat.
    expect(skyViewFieldDegrees(600)).toBe(MAX_FIELD_DEGREES)
  })

  it('clamps a tiny object up off the plate grain', () => {
    expect(skyViewFieldDegrees(0.5)).toBe(MIN_FIELD_DEGREES)
  })
})

describe('URL', () => {
  // The one mistake that yields a plausible-looking image of the wrong sky.
  it('converts right ascension from hours to degrees', () => {
    const m31 = objectByDesignation('M31')! as DeepSkyObject
    const [ra, dec] = params(skyViewUrl(m31)).get('position')!.split(',')

    expect(Number(ra)).toBeCloseTo(m31.ra * 15, 6)
    expect(Number(ra)).toBeCloseTo(10.68, 1)
    expect(Number(dec)).toBeCloseTo(m31.dec, 6)
  })

  it('asks for a 300px GIF from the red DSS2 plates in J2000', () => {
    const query = params(skyViewUrl(object()))

    expect(query.get('Survey')).toBe('dss2r')
    expect(query.get('Return')).toBe('GIF')
    expect(query.get('coordinates')).toBe('J2000')
    expect(query.get('pixels')).toBe('300')
  })

  it('sizes the frame from the object', () => {
    const query = params(skyViewUrl(object({ size: 60 })))

    expect(Number(query.get('size'))).toBeCloseTo(FRAMING_FACTOR, 3)
  })

  it('takes an explicit field over the object size', () => {
    const query = params(skyViewUrl(object({ size: 60 }), { fieldDegrees: 2 }))

    expect(Number(query.get('size'))).toBe(2)
  })

  it('accepts survey and pixel overrides', () => {
    const query = params(
      skyViewUrl(object(), { survey: 'digitized sky survey', pixels: 512 }),
    )

    expect(query.get('Survey')).toBe('digitized sky survey')
    expect(query.get('pixels')).toBe('512')
  })

  it('encodes a negative declination without losing the sign', () => {
    const query = params(skyViewUrl(object({ ra: 12.5, dec: -72.3 })))

    expect(query.get('position')).toBe('187.5,-72.3')
  })

  it('points at SkyView over https', () => {
    expect(skyViewUrl(object())).toMatch(
      /^https:\/\/skyview\.gsfc\.nasa\.gov\/current\/cgi\/runquery\.pl\?/,
    )
  })
})
