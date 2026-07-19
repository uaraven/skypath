<script lang="ts">
  /**
   * Scrubs the moment the charts flag with their indicator.
   *
   * The value is minutes since the start of the night window rather than a
   * `Date`, so the two sliders in the Results tab can bind to one number and
   * stay in step; the caller turns it back into the time shown alongside.
   */

  interface Props {
    /** Minutes since the start of the window. Bindable — the sliders share it. */
    value: number
    /** Length of the window in minutes. Not always 24h — DST moves it. */
    max: number
    /** The instant `value` stands for, already resolved by the caller. */
    time: Date
    /** Names the control for screen readers; the charts carry the visible one. */
    label: string
  }

  let { value = $bindable(), max, time, label }: Props = $props()

  /**
   * Five minutes matches the trajectory sampling step: a finer slider would
   * only interpolate between the same two samples, and it keeps a keyboard
   * traverse of the night down to a few hundred presses.
   */
  const STEP_MINUTES = 5

  const readout = $derived(
    time.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  )

  /** How far along the track the thumb is, 0–1. Drives the filled portion. */
  const fill = $derived(max === 0 ? 0 : value / max)
</script>

<div class="slider">
  <input
    type="range"
    min="0"
    {max}
    step={STEP_MINUTES}
    bind:value
    style="--fill: {fill}"
    aria-label={label}
    aria-valuetext={readout}
  />
  <output class="readout">{readout}</output>
</div>

<style>
  .slider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  /*
   * The control is drawn from scratch rather than tinted with `accent-color`:
   * the platform thumb is far bigger than this dark, thin-lined UI wants, and
   * it left the track looking like a broken progress bar.
   *
   * A native thumb is contained by its track — its centre travels from half a
   * thumb in to half a thumb short of the end — so at the extremes it reads as
   * "stuck" unless the fill agrees with it. Hence `--thumb` below: the track is
   * inset by half a thumb at each end, and the filled portion is measured
   * across exactly the distance the thumb centre covers, so the two line up all
   * the way to both ends.
   */
  input {
    --thumb: 15px;
    --track: 5px;

    flex: 1;
    min-width: 0;
    appearance: none;
    height: var(--thumb);
    background: transparent;
    cursor: pointer;
  }

  /*
   * WebKit and Firefox will not accept these in one selector list — either
   * vendor drops the whole rule on sight of the other's pseudo-element — so
   * the track and thumb are each written out twice.
   */
  input::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: calc(var(--track) / 2);
    background:
      linear-gradient(var(--chart-marker), var(--chart-marker)) no-repeat left
        center / calc(var(--thumb) / 2 + var(--fill) * (100% - var(--thumb)))
        100%,
      var(--bg-inset);
    border: 1px solid var(--border);
  }

  input::-moz-range-track {
    height: var(--track);
    border-radius: calc(var(--track) / 2);
    background:
      linear-gradient(var(--chart-marker), var(--chart-marker)) no-repeat left
        center / calc(var(--thumb) / 2 + var(--fill) * (100% - var(--thumb)))
        100%,
      var(--bg-inset);
    border: 1px solid var(--border);
  }

  input::-webkit-slider-thumb {
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: var(--chart-marker);
    /* Centre the thumb on the track: half the difference, plus the border. */
    margin-top: calc((var(--track) - var(--thumb)) / 2 + 1px);
    transition: box-shadow var(--transition);
  }

  input::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border: none;
    border-radius: 50%;
    background: var(--chart-marker);
    transition: box-shadow var(--transition);
  }

  /* Focus lands on the thumb, so the ring goes there rather than round the box. */
  input:focus {
    outline: none;
  }

  input:focus-visible::-webkit-slider-thumb {
    box-shadow:
      0 0 0 3px var(--bg),
      0 0 0 5px var(--accent-bright);
  }

  input:focus-visible::-moz-range-thumb {
    box-shadow:
      0 0 0 3px var(--bg),
      0 0 0 5px var(--accent-bright);
  }

  .readout {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text);
    white-space: nowrap;
    /*
     * Reserve the width the longest date needs: the readout changes on every
     * drag frame, and letting it size to its content shoves the slider
     * sideways under the user's pointer.
     */
    min-width: 15ch;
    text-align: right;
  }

  @media (max-width: 600px) {
    .slider {
      flex-wrap: wrap;
    }

    .readout {
      text-align: left;
    }
  }
</style>
