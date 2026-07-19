<script lang="ts">
  /**
   * The Results tab: everything about one object on one night from one site.
   */
  import { nightEvents } from '../lib/astro/events'
  import type { GeoLocation, SkyObject } from '../lib/astro/types'
  import { formatDesignation, isCatalogObject, typeLabel } from '../lib/catalog'
  import { allSkyChartModel, altitudeChartModel } from '../lib/charts'
  import type { Horizon } from '../lib/horizon'
  import AllSkyChart from './AllSkyChart.svelte'
  import AltitudeChart from './AltitudeChart.svelte'
  import EventTimesPanel from './EventTimesPanel.svelte'

  interface Props {
    object: SkyObject | null
    location: GeoLocation
    horizon: Horizon
    date: Date
    observatoryName: string
  }

  let { object, location, horizon, date, observatoryName }: Props = $props()

  const model = $derived(
    object ? altitudeChartModel({ object, location, date, horizon }) : null,
  )

  const allSkyModel = $derived(
    object ? allSkyChartModel({ object, location, date, horizon }) : null,
  )

  const events = $derived(
    object ? nightEvents({ object, location, date, horizon }) : null,
  )

  const designations = $derived(
    object && isCatalogObject(object)
      ? object.designations.map(formatDesignation).join(' · ')
      : null,
  )

  const type = $derived(
    object && isCatalogObject(object) ? typeLabel(object.type) : null,
  )
</script>

{#if !object || !model || !allSkyModel || !events}
  <p class="empty">
    No object chosen yet — find one in the Search tab and pick it.
  </p>
{:else}
  <div class="results">
    <header>
      <h2>{object.name}</h2>
      <p class="meta">
        {#if designations}<span>{designations}</span>{/if}
        {#if type}<span>{type}</span>{/if}
        <span>from {observatoryName}</span>
        <span>{date.toLocaleDateString()}</span>
      </p>
    </header>

    <section class="panel">
      <h3>Altitude</h3>
      <AltitudeChart {model} />
    </section>

    <section class="panel">
      <h3>All-sky view</h3>
      <AllSkyChart model={allSkyModel} />
    </section>

    <section class="panel">
      <h3>Times and directions</h3>
      <EventTimesPanel {events} horizonIsFlat={horizon.isFlat} />
    </section>
  </div>
{/if}

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  header h2 {
    line-height: 1.2;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  section h3 {
    margin-bottom: 0.75rem;
  }

  .empty {
    font-size: 0.85rem;
    color: var(--text-dim);
  }
</style>
