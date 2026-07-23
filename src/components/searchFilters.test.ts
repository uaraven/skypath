import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  defaultFilters,
  filtersActive,
  formatAngularSize,
  minSizeArcmin,
} from './searchFilters'

describe('minSizeArcmin', () => {
  it('is undefined when the size field is blank', () => {
    expect(minSizeArcmin(defaultFilters())).toBeUndefined()
  })

  it('converts the chosen unit to arcminutes', () => {
    const f = defaultFilters()
    expect(minSizeArcmin({ ...f, minSize: 10, minSizeUnit: 'arcmin' })).toBe(10)
    expect(minSizeArcmin({ ...f, minSize: 2, minSizeUnit: 'deg' })).toBe(120)
    expect(minSizeArcmin({ ...f, minSize: 30, minSizeUnit: 'arcsec' })).toBe(
      0.5,
    )
  })
})

describe('formatAngularSize', () => {
  it('uses degrees for large objects', () => {
    expect(formatAngularSize(177.83)).toBe('3.0°')
    expect(formatAngularSize(60)).toBe('1.0°')
  })

  it('uses arcminutes in the middle', () => {
    expect(formatAngularSize(16.2)).toBe('16′')
    expect(formatAngularSize(1)).toBe('1′')
  })

  it('uses arcseconds below a minute', () => {
    expect(formatAngularSize(0.5)).toBe('30″')
  })
})

describe('size filter accounting', () => {
  it('counts and flags a set size filter', () => {
    const f = { ...defaultFilters(), minSize: 10 }
    expect(filtersActive(f)).toBe(true)
    expect(activeFilterCount(f)).toBe(1)
  })

  it('ignores a blank size filter', () => {
    const f = defaultFilters()
    expect(filtersActive(f)).toBe(false)
    expect(activeFilterCount(f)).toBe(0)
  })
})
