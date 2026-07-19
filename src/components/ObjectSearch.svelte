<script lang="ts">
  /**
   * The Search tab: a query box over the catalog, and a result row per match
   * carrying tonight's altitude chart for the selected observatory.
   *
   * The charts are the expensive part — one trajectory per row — so results
   * are capped and sampled coarsely, and the query is debounced rather than
   * recomputed on every keystroke.
   */
  import type { GeoLocation, SkyObject } from '../lib/astro/types'
  import {
    formatDesignation,
    isCatalogObject,
    searchObjects,
    typeLabel,
  } from '../lib/catalog'
  import { altitudeChartModel } from '../lib/charts'
  import type { Horizon } from '../lib/horizon'
  import AltitudeChart from './AltitudeChart.svelte'

  interface Props {
    location: GeoLocation
    horizon: Horizon
    date: Date
    onselect: (object: SkyObject) => void
  }

  let { location, horizon, date, onselect }: Props = $props()

  /** Enough to choose from, few enough that the charts stay cheap. */
  const MAX_RESULTS = 8

  /** Thumbnails are ~420 units wide, so finer sampling would not be visible. */
  const THUMBNAIL_STEP_MINUTES = 15

  const DEBOUNCE_MS = 200

  let query = $state('')
  let applied = $state('')

  // Typing settles before the charts are built; the Search button and Enter
  // bypass the wait.
  $effect(() => {
    const pending = query
    const timer = setTimeout(() => (applied = pending), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  })

  const results = $derived(searchObjects(applied, MAX_RESULTS))

  const rows = $derived(
    results.map(({ object }) => ({
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

  /** Every designation the object answers to, or its kind for a planet. */
  function subtitleOf(object: SkyObject): string {
    if (!isCatalogObject(object)) {
      return object.kind === 'planet' ? 'Planet' : object.kind
    }
    const designations = object.designations.map(formatDesignation).join(' · ')
    const type = typeLabel(object.type)
    return type ? `${designations} — ${type}` : designations
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
  }
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

  {#if applied.trim() === ''}
    <p class="empty">
      Search the Messier catalogue and the planets by name, designation or type.
      Pick a result to see it in full.
    </p>
  {:else if rows.length === 0}
    <p class="empty">Nothing matches “{applied}”.</p>
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
