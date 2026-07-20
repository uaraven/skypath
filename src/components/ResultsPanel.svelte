<script lang="ts">
  /**
   * The Results tab: everything about one object on one night from one site.
   */
  import { nightEvents } from '../lib/astro/events'
  import { MS_PER_MINUTE, nightWindow, windowHours } from '../lib/astro/time'
  import type { GeoLocation, SkyObject } from '../lib/astro/types'
  import { formatDesignation, isCatalogObject, typeLabel } from '../lib/catalog'
  import { allSkyChartModel, altitudeChartModel, clamp } from '../lib/charts'
  import type { Horizon } from '../lib/horizon'
  import AllSkyChart from './AllSkyChart.svelte'
  import AltitudeChart from './AltitudeChart.svelte'
  import EventTimesPanel from './EventTimesPanel.svelte'
  import TimeSlider from './TimeSlider.svelte'

  interface Props {
    object: SkyObject | null
    location: GeoLocation
    horizon: Horizon
    date: Date
    observatoryName: string
  }

  let { object, location, horizon, date, observatoryName }: Props = $props()

  const model = $derived(
    object
      ? altitudeChartModel({ object, location, date, horizon, includeMoon: true })
      : null,
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

  /**
   * The scrubbed time, held as minutes from the start of the night so that it
   * survives a change of date or object: the user is picking a moment of the
   * night ("just after 1am"), not an absolute instant.
   *
   * The window runs local noon → noon, so 12 hours in is local midnight.
   */
  let offsetMinutes = $state(12 * 60)

  const window = $derived(nightWindow(date))
  const spanMinutes = $derived(Math.round(windowHours(window) * 60))

  const markerTime = $derived(
    new Date(
      window.start.getTime() +
        clamp(offsetMinutes, 0, spanMinutes) * MS_PER_MINUTE,
    ),
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
      <AltitudeChart {model} {markerTime} />
      <TimeSlider
        bind:value={offsetMinutes}
        max={spanMinutes}
        time={markerTime}
        label="Time shown on the altitude chart"
      />
    </section>

    <section class="panel">
      <h3>All-sky view</h3>
      <AllSkyChart model={allSkyModel} {markerTime} />
      <TimeSlider
        bind:value={offsetMinutes}
        max={spanMinutes}
        time={markerTime}
        label="Time shown on the all-sky chart"
      />
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
