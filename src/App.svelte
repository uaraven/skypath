<script lang="ts">
  /**
   * The two-panel shell: observatories on the left, a Search / Results tabview
   * on the right (`.plan/ui-mocks.md`).
   *
   * App owns the cross-cutting selections — which object, which date — because
   * both tabs read them and the Search tab writes one of them.
   */
  import ObjectSearch from './components/ObjectSearch.svelte'
  import ObservatoryManager from './components/ObservatoryManager.svelte'
  import ResultsPanel from './components/ResultsPanel.svelte'
  import type { SkyObject } from './lib/astro/types'
  import { horizonFromText } from './lib/horizon'
  import { observatories } from './lib/observatory'

  type Tab = 'search' | 'results'

  const selected = $derived(
    $observatories.observatories.find(
      (o) => o.id === $observatories.selectedId,
    ) ?? $observatories.observatories[0],
  )

  const horizon = $derived(horizonFromText(selected.horizonText))

  const location = $derived({
    latitude: selected.latitude,
    longitude: selected.longitude,
    elevation: selected.elevation,
  })

  let tab = $state<Tab>('search')
  let object = $state<SkyObject | null>(null)
  // `<input type="date">` speaks `YYYY-MM-DD`; keeping the state in that form
  // avoids round-tripping a Date through the local/UTC boundary on every edit.
  let dateText = $state(isoDate(new Date()))

  const date = $derived(fromIsoDate(dateText))

  function isoDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
  }

  /**
   * Parsed as *local* midnight. `new Date('2026-07-19')` would be parsed as
   * UTC and land on the previous day west of Greenwich, shifting the whole
   * noon→noon window by a night.
   */
  function fromIsoDate(text: string): Date {
    const [year, month, day] = text.split('-').map(Number)
    if (!year || !month || !day) return new Date()
    return new Date(year, month - 1, day)
  }

  function choose(chosen: SkyObject) {
    object = chosen
    tab = 'results'
  }
</script>

<div class="app">
  <header class="masthead">
    <h1>FlightPlan</h1>
    <p class="tagline">Plan what to observe, and when.</p>
  </header>

  <main>
    <ObservatoryManager />

    <section class="panel workspace">
      <div class="tabbar">
        <div role="tablist" aria-label="Views">
          <button
            type="button"
            role="tab"
            id="tab-search"
            aria-selected={tab === 'search'}
            aria-controls="panel-search"
            class:active={tab === 'search'}
            onclick={() => (tab = 'search')}>Search</button
          >
          <button
            type="button"
            role="tab"
            id="tab-results"
            aria-selected={tab === 'results'}
            aria-controls="panel-results"
            class:active={tab === 'results'}
            onclick={() => (tab = 'results')}>Results</button
          >
        </div>

        <label class="date">
          <span>Night of</span>
          <input type="date" bind:value={dateText} />
        </label>
      </div>

      {#if tab === 'search'}
        <div role="tabpanel" id="panel-search" aria-labelledby="tab-search">
          <ObjectSearch {location} {horizon} {date} onselect={choose} />
        </div>
      {:else}
        <div role="tabpanel" id="panel-results" aria-labelledby="tab-results">
          <ResultsPanel
            {object}
            {location}
            {horizon}
            {date}
            observatoryName={selected.name}
          />
        </div>
      {/if}
    </section>
  </main>
</div>

<style>
  .app {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .masthead {
    margin-bottom: 1.5rem;
  }

  .tagline {
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  /* The mock's vertical split: a fixed-width site list, charts taking the rest. */
  main {
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr);
    align-items: start;
    gap: 1.5rem;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .tabbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
  }

  [role='tablist'] {
    display: flex;
    gap: 0.5rem;
  }

  [role='tab'].active {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .date {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .date input {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  /* Below the split the list stacks above the workspace rather than squeezing. */
  @media (max-width: 800px) {
    main {
      grid-template-columns: 1fr;
    }
  }
</style>
