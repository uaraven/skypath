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
  import { angularSeparation } from '../lib/astro/ephemeris'
  import { MOON } from '../lib/astro/moon'
  import { MS_PER_MINUTE, nightWindow, windowHours } from '../lib/astro/time'
  import {
    isDeepSky,
    type GeoLocation,
    type SkyObject,
  } from '../lib/astro/types'
  import {
    formatDesignation,
    isCatalogObject,
    telescopiusUrl,
    typeLabel,
  } from '../lib/catalog'
  import {
    allSkyChartModel,
    altitudeChartModel,
    clamp,
    trajectoryAt,
    yearlyChartModel,
  } from '../lib/charts'
  import type { Horizon } from '../lib/horizon'
  import { framingViewParams } from '../lib/images'
  import { rigOptics, type Rig } from '../lib/rig'
  import AllSkyChart from './AllSkyChart.svelte'
  import AltitudeChart from './AltitudeChart.svelte'
  import EventTimesPanel from './EventTimesPanel.svelte'
  import FramingAssistant from './FramingAssistant.svelte'
  import Icon from './Icon.svelte'
  import telescopiusIcon from '../assets/telescopius-favicon.png'
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
    /** The selected rig, if any — sizes the framing assistant's view and
     *  draws the camera-frame rectangle. Null renders exactly today's
     *  object-sized sky view, with no frame. */
    rig?: Rig | null
    /** Camera rotation (position angle, 0–360°); one value shared across
     *  every rig and object, persisted by the caller. */
    frameRotation?: number
  }

  let {
    object,
    location,
    horizon,
    date,
    observatoryName,
    imageOpen = $bindable(true),
    rig = null,
    frameRotation = $bindable(0),
  }: Props = $props()

  /**
   * Only deep-sky objects get a sky view. A planet or the Moon moves against
   * the background stars, so a cutout of the sky it happens to be crossing
   * tonight would show everything except the target.
   */
  const image = $derived.by(() => {
    if (!object || !isDeepSky(object)) return null
    const { target, fov, survey, frame } = framingViewParams(object, rig)
    return {
      target,
      fov,
      survey,
      frame,
      alt: `Sky view of ${object.name}`,
      caption: rig
        ? formatRigCaption(rig)
        : `${formatAngularSize(fov * 60)} field`,
    }
  })

  function formatRigCaption(rig: Rig): string {
    const optics = rigOptics(rig)
    return (
      `${optics.fovWidthDeg.toFixed(2)}° × ${optics.fovHeightDeg.toFixed(2)}° · ` +
      `${optics.arcsecPerPixelX.toFixed(2)}″/px`
    )
  }

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

  const telescopiusHref = $derived(
    object && isCatalogObject(object)
      ? telescopiusUrl(object.designations)
      : null,
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

  // Altitude at the scrubbed instant, read alongside both sliders.
  const markerAltitude = $derived(
    model ? trajectoryAt(model.points, markerTime) : null,
  )

  // Angular distance to the Moon at the scrubbed instant. Solved exactly
  // rather than read off a sampled track — there's no arc to draw, just a
  // number, and two extra ephemeris calls per scrub frame is cheap. Null
  // when the Moon itself is the target: a distance to itself is not a fact
  // worth showing, the same reasoning that already hides the Moon overlay
  // toggle for that case.
  const moonSeparation = $derived(
    object && !targetIsMoon
      ? angularSeparation(object, MOON, markerTime, location)
      : null,
  )

  const suffix = $derived(
    [
      markerAltitude && `Alt: ${Math.round(markerAltitude.altitude)}°`,
      moonSeparation !== null && `To Moon: ${Math.round(moonSeparation)}°`,
    ]
      .filter(Boolean)
      .join(' · ') || undefined,
  )
</script>

{#if !object || !model || !allSkyModel || !events || !yearlyModel}
  <p class="empty">
    No object chosen yet — find one in the Search tab and pick it.
  </p>
{:else}
  <div class="results">
    <header>
      <h2>
        {object.name}
        {#if telescopiusHref}
          <a
            class="telescopius-link"
            href={telescopiusHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${object.name} on Telescopius`}
            title={`View ${object.name} on Telescopius`}
          >
            <img src={telescopiusIcon} alt="" width="16" height="16" />
          </a>
        {/if}
      </h2>
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
      <FramingAssistant
        target={image.target}
        fov={image.fov}
        survey={image.survey}
        alt={image.alt}
        caption={image.caption}
        frame={image.frame}
        bind:rotation={frameRotation}
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
        {suffix}
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
        {suffix}
      />
      {#if !targetIsMoon}
        <label class="moon-toggle">
          <input type="checkbox" bind:checked={showMoon} />
          <span>Show the Moon</span>
        </label>
      {/if}
    </section>

    <section class="panel">
      <h3>Yearly altitude at midnight</h3>
      {#key `${object.id}-${yearlyModel.year}`}
        <YearlyChart
          model={yearlyModel}
          {location}
          {horizon}
          includeMoon={overlayMoon}
        />
      {/key}
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
    display: flex;
    align-items: center;
    gap: 0.4rem;
    line-height: 1.2;
  }

  .telescopius-link {
    display: inline-flex;
    opacity: 0.7;
  }

  .telescopius-link:hover {
    opacity: 1;
  }

  .telescopius-link img {
    display: block;
    border-radius: 3px;
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
