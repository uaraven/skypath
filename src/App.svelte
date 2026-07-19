<script lang="ts">
  // Phase 4 shell — the real pickers and layout arrive in Phase 7.
  import AltitudeChart from './components/AltitudeChart.svelte'
  import ObservatoryManager from './components/ObservatoryManager.svelte'
  import { altitudeChartModel } from './lib/charts'
  import { objectByDesignation } from './lib/catalog'
  import { horizonFromText } from './lib/horizon'
  import { observatories } from './lib/observatory'

  const selected = $derived(
    $observatories.observatories.find(
      (o) => o.id === $observatories.selectedId,
    ) ?? $observatories.observatories[0],
  )

  const horizon = $derived(horizonFromText(selected.horizonText))

  // Until the object and date pickers land, the chart previews a fixed target
  // for tonight so the phase is exercisable by hand.
  const object = objectByDesignation('M13')!
  const today = new Date()

  const model = $derived(
    altitudeChartModel({
      object,
      location: { latitude: selected.latitude, longitude: selected.longitude },
      date: today,
      horizon,
    }),
  )
</script>

<div class="app">
  <header>
    <h1>FlightPlan</h1>
    <p class="tagline">Plan what to observe, and when.</p>
  </header>

  <main>
    <ObservatoryManager />

    <section class="panel">
      <h3>{object.name} tonight</h3>
      <p class="note">
        From {selected.name}. Object and date pickers arrive in Phase 7.
      </p>
      <AltitudeChart {model} />
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
</style>
