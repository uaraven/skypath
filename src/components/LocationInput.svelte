<script lang="ts">
  import { LATITUDE_RANGE, LONGITUDE_RANGE } from '../lib/observatory'
  import Icon from './Icon.svelte'

  /**
   * Nullable because an emptied `<input type="number">` binds to null; the
   * caller validates before turning a draft into a stored observatory.
   */
  interface Props {
    latitude: number | null
    longitude: number | null
    elevation: number | null
  }

  let {
    latitude = $bindable(),
    longitude = $bindable(),
    elevation = $bindable(),
  }: Props = $props()

  let locating = $state(false)
  let error = $state<string | null>(null)

  const supportsGeolocation =
    typeof navigator !== 'undefined' && 'geolocation' in navigator

  /**
   * The Geolocation API is callback-based and can hang indefinitely on a
   * denied-but-not-dismissed prompt, hence the explicit timeout.
   */
  function locate() {
    if (!supportsGeolocation) return
    locating = true
    error = null
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude = round(position.coords.latitude, 5)
        longitude = round(position.coords.longitude, 5)
        if (position.coords.altitude != null) {
          elevation = Math.round(position.coords.altitude)
        }
        locating = false
      },
      (failure) => {
        error =
          failure.code === failure.PERMISSION_DENIED
            ? 'Location permission denied.'
            : 'Could not determine your location.'
        locating = false
      },
      { timeout: 10_000, maximumAge: 60_000 },
    )
  }

  function round(value: number, digits: number): number {
    const factor = 10 ** digits
    return Math.round(value * factor) / factor
  }
</script>

<div class="location">
  <label>
    <span>Latitude</span>
    <input
      type="number"
      bind:value={latitude}
      min={LATITUDE_RANGE.min}
      max={LATITUDE_RANGE.max}
      step="0.00001"
    />
    <small>°N</small>
  </label>

  <label>
    <span>Longitude</span>
    <input
      type="number"
      bind:value={longitude}
      min={LONGITUDE_RANGE.min}
      max={LONGITUDE_RANGE.max}
      step="0.00001"
    />
    <small>°E</small>
  </label>

  <label>
    <span>Elevation</span>
    <input type="number" bind:value={elevation} step="1" placeholder="0" />
    <small>m</small>
  </label>

  {#if supportsGeolocation}
    <button
      type="button"
      class="locate icon-button"
      class:locating
      aria-label={locating ? 'Locating…' : 'Use my location'}
      title={locating ? 'Locating…' : 'Use my location'}
      onclick={locate}
      disabled={locating}
    >
      <Icon name="pin" />
    </button>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .location {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
  }

  label {
    display: grid;
    grid-template-columns: auto auto;
    gap: 0 0.35rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  label span {
    grid-column: 1 / -1;
  }

  input {
    /* Wide enough for a signed five-decimal degree — what "use my location"
       fills in — so the value is never visually clipped. */
    width: 12ch;
    font-family: var(--font-mono);
  }

  small {
    align-self: center;
    color: var(--text-faint);
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
  }

  /* Sits on the input baseline, not the taller label-plus-input stack. */
  .locate {
    align-self: end;
  }

  /* A quiet pulse while the geolocation prompt is outstanding. */
  .locate.locating {
    animation: locate-pulse 1s ease-in-out infinite;
  }

  @keyframes locate-pulse {
    50% {
      opacity: 0.4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .locate.locating {
      animation: none;
      opacity: 0.6;
    }
  }

  .error {
    flex-basis: 100%;
    font-size: 0.8rem;
    color: var(--accent-bright);
  }
</style>
