import { describe, expect, it } from 'vitest'
import type { DeepSkyObject } from '../astro/types'
import { objectByDesignation } from '../catalog'
import {
  DEFAULT_FIELD_ARCMIN,
  DEFAULT_SURVEY,
  FRAMING_FACTOR,
  MAX_FIELD_DEGREES,
  MIN_FIELD_DEGREES,
  aladinViewParams,
  fieldOfViewDegrees,
} from './aladin'

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

describe('field of view', () => {
  it('frames the object with sky around it', () => {
    expect(fieldOfViewDegrees(60)).toBeCloseTo(FRAMING_FACTOR, 6)
  })

  it('falls back to 30 arcminutes when the catalog gives no size', () => {
    expect(fieldOfViewDegrees(undefined)).toBeCloseTo(
      (DEFAULT_FIELD_ARCMIN * FRAMING_FACTOR) / 60,
      6,
    )
    // A zero size is a missing size, not a point source.
    expect(fieldOfViewDegrees(0)).toBe(fieldOfViewDegrees(undefined))
  })

  it('clamps a degree-scale object to a readable frame', () => {
    // The Veil is several degrees across; a 1:1 cutout would be slow and flat.
    expect(fieldOfViewDegrees(600)).toBe(MAX_FIELD_DEGREES)
  })

  it('clamps a tiny object up off the plate grain', () => {
    expect(fieldOfViewDegrees(0.5)).toBe(MIN_FIELD_DEGREES)
  })
})

describe('view params', () => {
  // The one mistake that yields a plausible-looking view of the wrong sky.
  it('converts right ascension from hours to degrees', () => {
    const m31 = objectByDesignation('M31')! as DeepSkyObject
    const [ra, dec] = aladinViewParams(m31).target.split(' ')

    expect(Number(ra)).toBeCloseTo(m31.ra * 15, 6)
    expect(Number(ra)).toBeCloseTo(10.68, 1)
    expect(Number(dec)).toBeCloseTo(m31.dec, 6)
  })

  it('defaults to the DSS2 color survey', () => {
    expect(aladinViewParams(object()).survey).toBe(DEFAULT_SURVEY)
  })

  it('sizes the frame from the object', () => {
    expect(aladinViewParams(object({ size: 60 })).fov).toBeCloseTo(
      FRAMING_FACTOR,
      6,
    )
  })

  it('takes an explicit field over the object size', () => {
    const params = aladinViewParams(object({ size: 60 }), { fieldDegrees: 2 })

    expect(params.fov).toBe(2)
  })

  it('accepts a survey override', () => {
    const params = aladinViewParams(object(), { survey: 'P/DSS2/red' })

    expect(params.survey).toBe('P/DSS2/red')
  })

  it('encodes a negative declination without losing the sign', () => {
    const params = aladinViewParams(object({ ra: 12.5, dec: -72.3 }))

    expect(params.target).toBe('187.5 -72.3')
  })
})
