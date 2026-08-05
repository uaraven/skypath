<script lang="ts">
  /**
   * Altitude at local midnight across a calendar year: months left-to-right,
   * altitude 0–90° up. No horizon, no Moon overlay, no twilight bands — the
   * seasonal shape of "how high does this get around midnight," not a single
   * night's track (that's `AltitudeChart`).
   *
   * Purely presentational — everything astronomical arrives in `model`
   * (`lib/charts/yearly.ts`).
   */
  import {
    altitudeTicks,
    altitudeToY,
    markerTriangle,
    monthTicks,
    plotBottom,
    plotRight,
    polylinePath,
    timeToX,
    yearWindow,
    type Point,
    type PlotArea,
    type YearlyChartModel,
  } from '../lib/charts'
  import TimeSlider from './TimeSlider.svelte'

  interface Props {
    model: YearlyChartModel
  }

  let { model }: Props = $props()

  /**
   * Day of the year shown by the slider, as an index into `model.points`
   * (one sample per day). Initialised to the point nearest `model.current`
   * so the chart opens on today's position; the caller resets this
   * component (via `{#key}`) when the object or year changes, so a fresh
   * default is picked up rather than carrying a stale index across targets.
   */
  function defaultIndex(): number {
    if (model.current) {
      const idx = model.points.findIndex(
        (p) => p.time.getTime() === model.current!.time.getTime(),
      )
      if (idx >= 0) return idx
    }
    return 0
  }

  let selectedIndex = $state(defaultIndex())

  const WIDTH = 960
  const HEIGHT = 260
  const PLOT: PlotArea = { left: 46, top: 20, width: 900, height: 180 }

  const uid = $props.id()
  const clipId = `yearly-plot-${uid}`

  const span = $derived(yearWindow(model.year))
  const baseline = $derived(plotBottom(PLOT))

  function toPoint(sample: { time: Date; altitude: number }): Point {
    return {
      x: timeToX(sample.time, span, PLOT),
      y: altitudeToY(sample.altitude, PLOT),
    }
  }

  const trajectoryPath = $derived(polylinePath(model.points.map(toPoint)))

  const months = $derived(monthTicks(model.year))
  const altitudes = altitudeTicks()

  function formatDate(time: Date): string {
    return time.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })
  }

  const peak = $derived(
    model.peak && model.peak.altitude > 0
      ? {
          ...toPoint(model.peak),
          label: `${Math.round(model.peak.altitude)}°`,
          date: formatDate(model.peak.time),
        }
      : null,
  )

  const MARKER_SIZE = 12

  /** The sample the slider currently points at. */
  const selected = $derived(model.points[selectedIndex] ?? null)

  const marker = $derived.by(() => {
    if (!selected) return null
    const point = toPoint(selected)
    return {
      x: point.x,
      path: markerTriangle(point, MARKER_SIZE),
    }
  })

  const selectedReadout = $derived(
    selected
      ? `${formatDate(selected.time)} — ${Math.round(selected.altitude)}°`
      : '',
  )

  const summary = $derived(
    [
      peak
        ? `${model.object.name} in ${model.year}: peaks around ${peak.label} on ${peak.date}`
        : `${model.object.name} in ${model.year}: stays below the horizon all year`,
      selected &&
        `${formatDate(selected.time)} selected: around ${Math.round(selected.altitude)}°`,
    ]
      .filter(Boolean)
      .join('; '),
  )
</script>

<figure class="chart">
  <svg
    viewBox="0 0 {WIDTH} {HEIGHT}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={summary}
  >
    <title>{summary}</title>

    <defs>
      <clipPath id={clipId}>
        <rect
          x={PLOT.left}
          y={PLOT.top}
          width={PLOT.width}
          height={PLOT.height}
        />
      </clipPath>
    </defs>

    <g clip-path="url(#{clipId})">
      {#each months as month (month.time.getTime())}
        <line
          class="grid"
          x1={timeToX(month.time, span, PLOT)}
          x2={timeToX(month.time, span, PLOT)}
          y1={PLOT.top}
          y2={baseline}
        />
      {/each}

      {#each altitudes as altitude (altitude)}
        <line
          class="grid"
          x1={PLOT.left}
          x2={plotRight(PLOT)}
          y1={altitudeToY(altitude, PLOT)}
          y2={altitudeToY(altitude, PLOT)}
        />
      {/each}

      <path class="trajectory" d={trajectoryPath} />

      {#if peak}
        <circle class="peak" cx={peak.x} cy={peak.y} r={5} />
      {/if}

      {#if marker}
        <line
          class="marker-line"
          x1={marker.x}
          x2={marker.x}
          y1={PLOT.top}
          y2={baseline}
        />
        <path class="marker" d={marker.path} />
      {/if}
    </g>

    <rect
      class="frame"
      x={PLOT.left}
      y={PLOT.top}
      width={PLOT.width}
      height={PLOT.height}
    />

    {#each altitudes as altitude (altitude)}
      <text
        class="label altitude-label"
        x={PLOT.left - 10}
        y={altitudeToY(altitude, PLOT)}
        text-anchor="end"
        dominant-baseline="middle">{altitude}</text
      >
    {/each}

    {#each months as month (month.time.getTime())}
      <text
        class="label month-label"
        x={timeToX(month.time, span, PLOT)}
        y={baseline + 20}
        text-anchor="start">{month.label}</text
      >
    {/each}

    {#if peak}
      <text
        class="label peak-label"
        x={peak.x}
        y={Math.max(peak.y - 12, PLOT.top + 12)}
        text-anchor={peak.x > plotRight(PLOT) - 40 ? 'end' : 'middle'}
        >{peak.label}</text
      >
    {/if}
  </svg>
</figure>

{#if selected}
  <TimeSlider
    bind:value={selectedIndex}
    max={model.points.length - 1}
    step={1}
    time={selected.time}
    label="Date shown on the yearly chart"
    readout={selectedReadout}
  />
{/if}

<style>
  .chart {
    margin: 0;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    background-color: var(--bg-inset);
    border-radius: var(--radius-card);
  }

  .grid {
    stroke: var(--chart-grid);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }

  .frame {
    fill: none;
    stroke: var(--border);
    stroke-width: 1;
  }

  .trajectory {
    fill: none;
    stroke: var(--chart-trajectory);
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .peak {
    fill: var(--text);
  }

  .marker {
    fill: var(--chart-marker);
  }

  .marker-line {
    stroke: var(--chart-marker);
    stroke-width: 1;
    opacity: 0.45;
  }

  .label {
    fill: var(--chart-label);
    font-family: var(--font-mono);
    font-size: 14px;
  }

  .peak-label {
    fill: var(--text);
    font-size: 15px;
  }

  .month-label {
    font-size: 12px;
  }
</style>
