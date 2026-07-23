/**
 * The Search tab's filter state, lifted out of the component so `App` can hold
 * it across the tabview unmounting the tab — the same reason the query lives
 * there. `null` on a number means the field is blank and its filter is off.
 */
export type SizeUnit = 'deg' | 'arcmin' | 'arcsec'

export interface SearchFilters {
  /** Selected OpenNGC type codes (`G`, `OCl`, `EmN`, …); empty means any type. */
  types: string[]
  /** Keep objects at least this bright; `null` leaves magnitude unfiltered. */
  maxMagnitude: number | null
  /** Keep objects at least this large, in `minSizeUnit`; `null` leaves size unfiltered. */
  minSize: number | null
  /** Unit the `minSize` value is expressed in. */
  minSizeUnit: SizeUnit
  /**
   * The "above" threshold the object must stay clear of: `''` off, `'horizon'`
   * for the observatory's own horizon, otherwise a degrees value as a string
   * (the `<select>` speaks strings).
   */
  above: string
  /** Hours the object must stay above the chosen threshold. */
  aboveHours: number
  /** Count only the hours between sunset and sunrise towards `aboveHours`. */
  duringNight: boolean
}

export function defaultFilters(): SearchFilters {
  return {
    types: [],
    maxMagnitude: null,
    minSize: null,
    minSizeUnit: 'arcmin',
    above: '',
    aboveHours: 1,
    duringNight: true,
  }
}

/** Arcminutes per unit, for converting the size filter to the catalog's unit. */
const UNIT_TO_ARCMIN: Record<SizeUnit, number> = {
  deg: 60,
  arcmin: 1,
  arcsec: 1 / 60,
}

/** The size threshold in arcminutes, or `undefined` when the field is blank. */
export function minSizeArcmin(filters: SearchFilters): number | undefined {
  return filters.minSize == null
    ? undefined
    : filters.minSize * UNIT_TO_ARCMIN[filters.minSizeUnit]
}

/**
 * A major axis in arcminutes as a compact human string: degrees for large
 * objects (`3.2°`), arcminutes down to `1′`, arcseconds below that (`45″`).
 */
export function formatAngularSize(arcmin: number): string {
  if (arcmin >= 60) return `${(arcmin / 60).toFixed(1)}°`
  if (arcmin >= 1) return `${Math.round(arcmin)}′`
  return `${Math.round(arcmin * 60)}″`
}

/** Reset an existing (bound) filter object in place, preserving its identity. */
export function resetFilters(filters: SearchFilters): void {
  Object.assign(filters, defaultFilters())
}

/** True when any filter would actually narrow the results. */
export function filtersActive(filters: SearchFilters): boolean {
  return (
    filters.types.length > 0 ||
    filters.maxMagnitude != null ||
    filters.minSize != null ||
    filters.above !== ''
  )
}

/** How many filters are set — shown as a badge on the panel's summary. */
export function activeFilterCount(filters: SearchFilters): number {
  return (
    (filters.types.length > 0 ? 1 : 0) +
    (filters.maxMagnitude != null ? 1 : 0) +
    (filters.minSize != null ? 1 : 0) +
    (filters.above !== '' ? 1 : 0)
  )
}
