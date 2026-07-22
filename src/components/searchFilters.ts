/**
 * The Search tab's filter state, lifted out of the component so `App` can hold
 * it across the tabview unmounting the tab — the same reason the query lives
 * there. `null` on a number means the field is blank and its filter is off.
 */
export interface SearchFilters {
  /** Selected OpenNGC type codes (`G`, `OCl`, `EmN`, …); empty means any type. */
  types: string[]
  /** Keep objects at least this bright; `null` leaves magnitude unfiltered. */
  maxMagnitude: number | null
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
    above: '',
    aboveHours: 1,
    duringNight: true,
  }
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
    filters.above !== ''
  )
}

/** How many filters are set — shown as a badge on the panel's summary. */
export function activeFilterCount(filters: SearchFilters): number {
  return (
    (filters.types.length > 0 ? 1 : 0) +
    (filters.maxMagnitude != null ? 1 : 0) +
    (filters.above !== '' ? 1 : 0)
  )
}
