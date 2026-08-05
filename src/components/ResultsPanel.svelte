<script lang="ts">
  /**
   * The Results tab: everything about one object on one night from one site.
   */
  import {
    equatorialPosition,
    formatCoordinatesForClipboard,
    formatDec,
    formatRa,
  } from '../lib/astro/coordinates'
  import { nightEvents } from '../lib/astro/events'
  import { MS_PER_MINUTE, nightWindow, windowHours } from '../lib/astro/time'
  import {
    isDeepSky,
    type GeoLocation,
    type SkyObject,
  } from '../lib/astro/types'
  import { formatDesignation, isCatalogObject, typeLabel } from '../lib/catalog'
  import {
    allSkyChartModel,
    altitudeChartModel,
    clamp,
    yearlyChartModel,
  } from '../lib/charts'
  import type { Horizon } from '../lib/horizon'
  import { skyViewFieldDegrees, skyViewUrl } from '../lib/images'
  import AllSkyChart from './AllSkyChart.svelte'
  import AltitudeChart from './AltitudeChart.svelte'
  import EventTimesPanel from './EventTimesPanel.svelte'
  import Icon from './Icon.svelte'
  import ObjectImage from './ObjectImage.svelte'
  import { formatAngularSize } from './searchFilters'
  import TimeSlider from './TimeSlider.svelte'
  import YearlyChart from './YearlyChart.svelte'

  interface Props {
    object: SkyObject | null
    location: GeoLocation
    horizon: Horizon
    date: Date
    observatoryName: string
    /** Whether the sky-image block is expanded; persisted by the caller. */
    imageOpen?: boolean
  }

  let {
    object,
    location,
    horizon,
    date,
    observatoryName,
    imageOpen = $bindable(true),
  }: Props = $props()

  /**
   * Only deep-sky objects get a survey image. A planet or the Moon moves
   * against the background stars, so a cutout of the sky it happens to be
   * crossing tonight would show everything except the target.
   */
  const image = $derived.by(() => {
    if (!object || !isDeepSky(object)) return null
    const field = skyViewFieldDegrees(object.size)
    return {
      url: skyViewUrl(object),
      alt: `Digitized Sky Survey image of ${object.name}`,
      caption: `${formatAngularSize(field * 60)} field · DSS2 red`,
    }
  })

  // The Moon is drawn on both charts as an overlay; the checkbox under the
  // slider toggles it. When the Moon itself is the target, the overlay would
  // just double the primary track, so it is suppressed and the toggle hidden —
  // the charts still draw the Moon's phase glyph on its own trajectory.
  let showMoon = $state(true)
  const targetIsMoon = $derived(object?.id === 'moon')
  const overlayMoon = $derived(showMoon && !targetIsMoon)

  const model = $derived(
    object
      ? altitudeChartModel({
          object,
          location,
          date,
          horizon,
          includeMoon: overlayMoon,
        })
      : null,
  )

  const allSkyModel = $derived(
    object
      ? allSkyChartModel({
          object,
          location,
          date,
          horizon,
          includeMoon: overlayMoon,
        })
      : null,
  )

  const events = $derived(
    object ? nightEvents({ object, location, date, horizon }) : null,
  )

  const yearlyModel = $derived(
    object
      ? yearlyChartModel({
          object,
          location,
          year: date.getFullYear(),
          date,
        })
      : null,
  )

  const designations = $derived(
    object && isCatalogObject(object)
      ? object.designations.map(formatDesignation).join(' · ')
      : null,
  )

  const type = $derived(
    object && isCatalogObject(object) ? typeLabel(object.type) : null,
  )

  // Anchored on local midnight rather than the scrubbed marker time: a
  // moving body's coordinates would otherwise creep across the night, and
  // this is a subtitle, not a live readout.
  const coordinates = $derived(
    object
      ? equatorialPosition(object, nightWindow(date).midnight, location)
      : null,
  )

  // Reverts on its own after a beat rather than on the next click, so the
  // button doesn't need a separate "reset" trigger.
  let copied = $state(false)
  let copiedTimeout: ReturnType<typeof setTimeout> | undefined

  async function copyCoordinates() {
    if (!coordinates) return
    await navigator.clipboard.writeText(
      formatCoordinatesForClipboard(coordinates),
    )
    copied = true
    clearTimeout(copiedTimeout)
    copiedTimeout = setTimeout(() => (copied = false), 1500)
  }

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

{#if !object || !model || !allSkyModel || !events || !yearlyModel}
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
        {#if coordinates}
          <span class="coordinates">
            ({formatRa(coordinates.ra)}
            {formatDec(coordinates.dec)})
            <button
              type="button"
              class="icon-button"
              aria-label={copied ? 'Coordinates copied' : 'Copy coordinates'}
              title={copied ? 'Copied!' : 'Copy coordinates'}
              onclick={copyCoordinates}
            >
              <Icon name={copied ? 'check' : 'copy'} size={14} />
            </button>
          </span>
        {/if}
        <span>from {observatoryName}</span>
        <span>{date.toLocaleDateString()}</span>
      </p>
    </header>

    {#if image}
      <ObjectImage
        url={image.url}
        alt={image.alt}
        caption={image.caption}
        bind:open={imageOpen}
      />
    {/if}

    <section class="panel">
      <h3>Altitude</h3>
      <AltitudeChart
        {model}
        {markerTime}
        onScrub={(minutes) => (offsetMinutes = minutes)}
      />
      <TimeSlider
        bind:value={offsetMinutes}
        max={spanMinutes}
        time={markerTime}
        label="Time shown on the altitude chart"
      />
      {#if !targetIsMoon}
        <label class="moon-toggle">
          <input type="checkbox" bind:checked={showMoon} />
          <span>Show the Moon</span>
        </label>
      {/if}
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
      {#if !targetIsMoon}
        <label class="moon-toggle">
          <input type="checkbox" bind:checked={showMoon} />
          <span>Show the Moon</span>
        </label>
      {/if}
    </section>

    <section class="panel">
      <h3>Yearly altitude</h3>
      <YearlyChart model={yearlyModel} />
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

  .coordinates {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem;
  }

  section h3 {
    margin-bottom: 0.75rem;
  }

  .moon-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-dim);
    cursor: pointer;
  }

  .empty {
    font-size: 0.85rem;
    color: var(--text-dim);
  }
</style>
