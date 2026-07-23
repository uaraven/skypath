<script lang="ts">
  /**
   * The Search tab: a query box over the catalog, and a result row per match
   * carrying tonight's altitude chart for the selected observatory.
   *
   * The charts are the expensive part — one trajectory per row — so results
   * are capped and sampled coarsely, and the query is debounced rather than
   * recomputed on every keystroke.
   */
  import type { GeoLocation, SkyObject, TimeWindow } from '../lib/astro/types'
  import {
    hoursAboveAltitude,
    hoursAboveHorizon,
    observingWindow,
  } from '../lib/astro/observability'
  import {
    formatDesignation,
    isCatalogObject,
    OBJECT_TYPES,
    searchObjects,
    typeLabel,
    type CatalogFilters,
    type SearchResult,
  } from '../lib/catalog'
  import { altitudeChartModel } from '../lib/charts'
  import type { Horizon } from '../lib/horizon'
  import AltitudeChart from './AltitudeChart.svelte'
  import {
    activeFilterCount,
    defaultFilters,
    filtersActive,
    formatAngularSize,
    minSizeArcmin,
    resetFilters,
    type SearchFilters,
  } from './searchFilters'

  interface Props {
    location: GeoLocation
    horizon: Horizon
    date: Date
    onselect: (object: SkyObject) => void
    /**
     * Bindable so the term outlives this component: the tabview unmounts the
     * Search tab, and the user expects their query and its results back when
     * they return from Results.
     */
    query?: string
    /** Bindable for the same reason as `query`: filters must survive the tab. */
    filters?: SearchFilters
  }

  let {
    location,
    horizon,
    date,
    onselect,
    query = $bindable(''),
    filters = $bindable(defaultFilters()),
  }: Props = $props()

  /** Enough to choose from, few enough that the charts stay cheap. */
  const MAX_RESULTS = 20

  /**
   * How many text/catalog matches to weigh an observability filter against.
   * The filter culls some, so we start from a wider pool than we display, but
   * bounded so the per-object trajectory work stays responsive.
   */
  const CANDIDATE_LIMIT = 200

  /** Thumbnails are ~420 units wide, so finer sampling would not be visible. */
  const THUMBNAIL_STEP_MINUTES = 15

  const DEBOUNCE_MS = 200

  /** Individual stars aren't observing targets, so they aren't offered. */
  const HIDDEN_TYPES = new Set(['*', '**'])

  /** The object types offered as filters, in the map's own order. */
  const typeOptions = Object.entries(OBJECT_TYPES)
    .filter(([code]) => !HIDDEN_TYPES.has(code))
    .map(([code, label]) => ({ code, label }))

  /** Altitude thresholds the "Above" dropdown offers, 15°–85° in 5° steps. */
  const ALTITUDE_OPTIONS = Array.from(
    { length: (85 - 15) / 5 + 1 },
    (_, i) => 15 + i * 5,
  )

  // Seeded from the incoming state so a restored search draws its results on
  // the first frame rather than flashing the empty state for one debounce.
  let applied = $state(query)
  let appliedFilters = $state<SearchFilters>($state.snapshot(filters))

  // Typing and dragging inputs settle before the charts are built; the Search
  // button and Enter bypass the wait for the query.
  $effect(() => {
    const pendingQuery = query
    const pendingFilters = $state.snapshot(filters)
    const timer = setTimeout(() => {
      applied = pendingQuery
      appliedFilters = pendingFilters
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  })

  const catalogFilters = $derived<CatalogFilters>({
    types:
      appliedFilters.types.length > 0
        ? new Set(appliedFilters.types)
        : undefined,
    maxMagnitude: appliedFilters.maxMagnitude ?? undefined,
    minSize: minSizeArcmin(appliedFilters),
  })

  // The "above" filter needs a trajectory per object, so it runs after the
  // cheap catalog search, over its candidate pool.
  const observabilityActive = $derived(appliedFilters.above !== '')

  const anyFilterActive = $derived(filtersActive(appliedFilters))

  const candidates = $derived(
    searchObjects(
      applied,
      observabilityActive ? CANDIDATE_LIMIT : MAX_RESULTS,
      catalogFilters,
      observabilityActive,
    ),
  )

  const matched = $derived(
    observabilityActive ? observableWithin(candidates) : candidates,
  )

  const rows = $derived(
    matched.map(({ object }) => ({
      object,
      subtitle: subtitleOf(object),
      model: altitudeChartModel({
        object,
        location,
        date,
        horizon,
        stepMinutes: THUMBNAIL_STEP_MINUTES,
      }),
    })),
  )

  /**
   * Keep the candidates that stay up long enough, in the order they came, and
   * stop once the display is full — the expensive check runs no more than it
   * must.
   */
  function observableWithin(pool: SearchResult[]): SearchResult[] {
    const window = observingWindow(date, location, appliedFilters.duringNight)
    // Restricting to darkness on a polar day leaves no night to observe in.
    if (window === null) return []

    const kept: SearchResult[] = []
    for (const result of pool) {
      if (meetsDuration(result.object, window)) kept.push(result)
      if (kept.length >= MAX_RESULTS) break
    }
    return kept
  }

  function meetsDuration(object: SkyObject, window: TimeWindow): boolean {
    const f = appliedFilters
    if (f.above === '') return true
    const hours =
      f.above === 'horizon'
        ? hoursAboveHorizon(object, location, window, horizon)
        : hoursAboveAltitude(object, location, window, Number(f.above))
    return hours >= f.aboveHours
  }

  /** Every designation the object answers to, or its kind for a planet. */
  function subtitleOf(object: SkyObject): string {
    if (!isCatalogObject(object)) {
      return object.kind === 'planet' ? 'Planet' : object.kind
    }
    const designations = object.designations.map(formatDesignation).join(' · ')
    const type = typeLabel(object.type)
    const head = type ? `${designations} — ${type}` : designations
    return object.size != null
      ? `${head} · ${formatAngularSize(object.size)}`
      : head
  }

  /**
   * The display name and the designation line duplicate each other for an
   * object with no common name (`M 76` is called "M 76"), so the row shows the
   * designations alone in that case.
   */
  function titleOf(object: SkyObject): string {
    if (!isCatalogObject(object)) return object.name
    return object.names[0] ?? object.name
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    applied = query
    appliedFilters = $state.snapshot(filters)
  }

  const filterCount = $derived(activeFilterCount(filters))
</script>

<div class="search">
  <form onsubmit={submit}>
    <label class="visually-hidden" for="object-query">Search objects</label>
    <input
      id="object-query"
      type="search"
      bind:value={query}
      placeholder="Andromeda, M 31, NGC 224, Jupiter…"
      autocomplete="off"
    />
    <button type="submit">Search</button>
  </form>

  <details class="filters">
    <summary>
      Filters{filterCount > 0 ? ` (${filterCount})` : ''}
    </summary>

    <div class="filter-body">
      <fieldset class="types">
        <legend>Object type</legend>
        <div class="type-options">
          {#each typeOptions as { code, label } (code)}
            <label class="type">
              <input type="checkbox" bind:group={filters.types} value={code} />
              {label}
            </label>
          {/each}
        </div>
      </fieldset>

      <div class="field">
        <span>Brighter than</span>
        <input
          type="number"
          step="0.5"
          bind:value={filters.maxMagnitude}
          placeholder="mag"
          aria-label="maximum magnitude"
        />
        <span class="unit">mag</span>
      </div>

      <div class="field">
        <span>Larger than</span>
        <input
          class="size-input"
          type="number"
          min="0"
          step="1"
          bind:value={filters.minSize}
          placeholder="size"
          aria-label="minimum size"
        />
        <label class="visually-hidden" for="size-unit">size unit</label>
        <select id="size-unit" bind:value={filters.minSizeUnit}>
          <option value="deg">°</option>
          <option value="arcmin">′</option>
          <option value="arcsec">″</option>
        </select>
      </div>

      <div class="field">
        <label for="above-threshold">Above</label>
        <select id="above-threshold" bind:value={filters.above}>
          <option value="">—</option>
          <option value="horizon">Horizon</option>
          {#each ALTITUDE_OPTIONS as degrees (degrees)}
            <option value={String(degrees)}>{degrees}°</option>
          {/each}
        </select>
        <span class="unit">for</span>
        <input
          type="number"
          min="0"
          step="0.5"
          bind:value={filters.aboveHours}
          aria-label="hours above threshold"
        />
        <span class="unit">h</span>
        <label class="toggle">
          <input type="checkbox" bind:checked={filters.duringNight} />
          during night
        </label>
      </div>

      <button
        type="button"
        class="clear"
        disabled={filterCount === 0}
        onclick={() => resetFilters(filters)}
      >
        Clear filters
      </button>
    </div>
  </details>

  {#if applied.trim() === '' && !anyFilterActive}
    <p class="empty">
      Search the Messier, NGC, IC, Sharpless 2 and LDN catalogues and the
      planets by name, designation or type — or use the filters to browse by
      type, brightness, apparent size and how long a target clears your horizon.
      Pick a result to see it in full.
    </p>
  {:else if rows.length === 0}
    <p class="empty">
      {#if applied.trim() === ''}
        No objects match these filters.
      {:else}
        Nothing matches “{applied}”.
      {/if}
    </p>
  {:else}
    <ul>
      {#each rows as row (row.object.id)}
        <li>
          <button
            type="button"
            class="result"
            onclick={() => onselect(row.object)}
          >
            <span class="identity">
              <span class="title">{titleOf(row.object)}</span>
              <span class="subtitle">{row.subtitle}</span>
            </span>
            <span class="thumbnail">
              <AltitudeChart model={row.model} compact />
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  form {
    display: flex;
    gap: 0.5rem;
  }

  form input {
    flex: 1;
  }

  .filters {
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    padding: 0.4rem 0.6rem;
  }

  .filters summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-dim);
  }

  .filter-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    font-size: 0.85rem;
  }

  .types {
    border: 0;
    padding: 0;
    margin: 0;
  }

  .types legend {
    padding: 0;
    margin-bottom: 0.4rem;
    color: var(--text-dim);
  }

  .type-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.9rem;
  }

  .type {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
  }

  .field {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .field input[type='number'] {
    width: 4rem;
    font-family: var(--font-mono);
  }

  /* Wider so the "size" placeholder isn't clipped. */
  .field input.size-input {
    width: 5.5rem;
  }

  .field select {
    font-family: var(--font-mono);
  }

  .field .unit {
    color: var(--text-dim);
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .clear {
    align-self: flex-start;
    font-size: 0.8rem;
  }

  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .result {
    /* A row, not a pill — overrides the shared button styling. */
    display: grid;
    grid-template-columns: minmax(9rem, 1fr) minmax(0, 2fr);
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    text-align: left;
  }

  .identity {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .title {
    font-size: 0.95rem;
    line-height: 1.3;
    color: var(--heading);
  }

  .subtitle {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-dim);
    line-height: 1.4;
  }

  .empty {
    font-size: 0.85rem;
    color: var(--text-dim);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (max-width: 700px) {
    .result {
      grid-template-columns: 1fr;
    }
  }
</style>
