<script lang="ts">
  // Phase 3 shell — replaced with the real layout in Phase 7.
  import ObservatoryManager from './components/ObservatoryManager.svelte'
  import { horizonFromText } from './lib/horizon'
  import { observatories } from './lib/observatory'

  const selected = $derived(
    $observatories.observatories.find(
      (o) => o.id === $observatories.selectedId,
    ) ?? $observatories.observatories[0],
  )

  const horizon = $derived(horizonFromText(selected.horizonText))

  const CARDINALS = [
    { label: 'N', azimuth: 0 },
    { label: 'NE', azimuth: 45 },
    { label: 'E', azimuth: 90 },
    { label: 'SE', azimuth: 135 },
    { label: 'S', azimuth: 180 },
    { label: 'SW', azimuth: 225 },
    { label: 'W', azimuth: 270 },
    { label: 'NW', azimuth: 315 },
  ]
</script>

<div class="app">
  <header>
    <h1>FlightPlan</h1>
    <p class="tagline">Plan what to observe, and when.</p>
  </header>

  <main>
    <ObservatoryManager />

    <section class="panel">
      <h3>Horizon check</h3>
      <p class="note">
        Interpolated horizon altitude of the saved horizon, in each cardinal
        direction. Charts arrive in Phase 4.
      </p>
      <ul class="cardinals">
        {#each CARDINALS as cardinal (cardinal.label)}
          <li>
            <span class="direction">{cardinal.label}</span>
            <span class="altitude"
              >{horizon.altitudeAt(cardinal.azimuth).toFixed(1)}°</span
            >
          </li>
        {/each}
      </ul>
    </section>
  </main>
</div>

<style>
  .app {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  header {
    margin-bottom: 2rem;
  }

  .tagline {
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .note {
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-bottom: 0.75rem;
  }

  .cardinals {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .cardinals li {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 4rem;
    padding: 0.4rem 0.6rem;
    background-color: var(--bg-inset);
    border-radius: 5px;
  }

  .direction {
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  .altitude {
    font-family: var(--font-mono);
    color: var(--accent-bright);
  }
</style>
