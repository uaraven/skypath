<script lang="ts">
  /**
   * Altitude over the night: a cylindrical plot with time (local noon → noon)
   * across and altitude 0–90° up, shaded by twilight phase.
   *
   * Purely presentational — everything astronomical arrives in `model`
   * (`lib/charts/model.ts`). The SVG scales to its container; all geometry is
   * in fixed user units inside the viewBox.
   */
  import {
    altitudeTicks,
    altitudeToY,
    areaPath,
    hourTicks,
    markerTriangle,
    plotBottom,
    plotRight,
    polylinePath,
    timeToX,
    trajectoryAt,
    type AltitudeChartModel,
    type PlotArea,
    type Point,
    type SkyPhase,
  } from '../lib/charts'

  interface Props {
    model: AltitudeChartModel
    /**
     * Thumbnail form for the search results: the same projection with the
     * axes, labels and caption dropped, so a row can carry a chart.
     */
    compact?: boolean
    /**
     * Instant to flag on the curve, from the Results tab's time slider.
     * Null — the default — draws no indicator at all.
     */
    markerTime?: Date | null
  }

  let { model, compact = false, markerTime = null }: Props = $props()

  const WIDTH = $derived(compact ? 420 : 960)
  const HEIGHT = $derived(compact ? 96 : 340)
  const PLOT: PlotArea = $derived(
    compact
      ? { left: 0, top: 0, width: 420, height: 96 }
      : { left: 46, top: 14, width: 900, height: 296 },
  )

  // Every instance needs its own clip path: the search tab renders a chart per
  // result row, and a shared id would point them all at the first one's plot.
  const uid = $props.id()
  const clipId = `altitude-plot-${uid}`

  /** Chart palette lives in theme.css so both charts shade identically. */
  const PHASE_FILL: Record<SkyPhase, string> = {
    day: 'var(--sky-day)',
    civil: 'var(--sky-civil)',
    nautical: 'var(--sky-nautical)',
    astronomical: 'var(--sky-astro)',
    night: 'var(--sky-night)',
  }

  const baseline = $derived(plotBottom(PLOT))

  const bands = $derived(
    model.bands.map((band) => {
      const x = timeToX(band.start, model.window, PLOT)
      const end = timeToX(band.end, model.window, PLOT)
      return {
        phase: band.phase,
        x,
        // Overlap by a unit so neighbouring rects cannot leave a hairline seam
        // at fractional coordinates; the clip path trims the last one.
        width: Math.max(end - x + 1, 0),
      }
    }),
  )

  const trajectoryPath = $derived(polylinePath(model.points.map(toPoint)))

  const horizonPoints = $derived(model.horizonTrack.map(toPoint))
  const horizonFill = $derived(areaPath(horizonPoints, baseline))
  const horizonLine = $derived(polylinePath(horizonPoints))

  const times = $derived(hourTicks(model.window))
  const altitudes = altitudeTicks()

  const peak = $derived(
    model.peak && model.peak.altitude > 0
      ? {
          x: timeToX(model.peak.time, model.window, PLOT),
          y: altitudeToY(model.peak.altitude, PLOT),
          label: `${Math.round(model.peak.altitude)}°`,
          time: model.peak.time,
        }
      : null,
  )

  const MARKER_SIZE = $derived(compact ? 7 : 12)

  const marker = $derived.by(() => {
    const at = markerTime ? trajectoryAt(model.points, markerTime) : null
    if (!at) return null

    const point = toPoint(at)
    return {
      x: point.x,
      // The triangle hangs off the curve itself, so a set object's indicator
      // rides the baseline exactly where `altitudeToY` clamps the curve to.
      path: markerTriangle(point, MARKER_SIZE),
      altitude: at.altitude,
      time: at.time,
    }
  })

  const summary = $derived(
    [
      peak
        ? `${model.object.name}: peaks at ${peak.label} at ${formatTime(peak.time)}`
        : `${model.object.name}: stays below the horizon all night`,
      marker &&
        `at ${formatTime(marker.time)} it is at ${Math.round(marker.altitude)}°`,
    ]
      .filter(Boolean)
      .join('; '),
  )

  function toPoint(sample: { time: Date; altitude: number }): Point {
    return {
      x: timeToX(sample.time, model.window, PLOT),
      y: altitudeToY(sample.altitude, PLOT),
    }
  }

  function formatHour(time: Date): string {
    return String(time.getHours()).padStart(2, '0')
  }

  function formatTime(time: Date): string {
    return `${formatHour(time)}:${String(time.getMinutes()).padStart(2, '0')}`
  }
</script>

<figure class="chart" class:compact>
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
      {#each bands as band, i (i)}
        <rect
          class="band"
          data-phase={band.phase}
          x={band.x}
          y={PLOT.top}
          width={band.width}
          height={PLOT.height}
          fill={PHASE_FILL[band.phase]}
        />
      {/each}

      {#if !compact}
        {#each times as time (time.getTime())}
          <line
            class="grid"
            x1={timeToX(time, model.window, PLOT)}
            x2={timeToX(time, model.window, PLOT)}
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
      {/if}

      <path class="horizon-fill" d={horizonFill} />
      <path class="horizon-line" d={horizonLine} />
      <path class="trajectory" d={trajectoryPath} />

      {#if peak}
        <circle class="peak" cx={peak.x} cy={peak.y} r={compact ? 3 : 5} />
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

    <!-- Axis frame drawn after the clipped content so it stays crisp on top. -->
    <rect
      class="frame"
      x={PLOT.left}
      y={PLOT.top}
      width={PLOT.width}
      height={PLOT.height}
    />

    {#if !compact}
      {#each altitudes as altitude (altitude)}
        <text
          class="label altitude-label"
          x={PLOT.left - 10}
          y={altitudeToY(altitude, PLOT)}
          text-anchor="end"
          dominant-baseline="middle">{altitude}</text
        >
      {/each}

      {#each times as time (time.getTime())}
        <text
          class="label time-label"
          x={timeToX(time, model.window, PLOT)}
          y={baseline + 20}
          text-anchor="middle">{formatHour(time)}</text
        >
      {/each}

      {#if peak}
        <text
          class="label peak-label"
          x={peak.x}
          y={peak.y - 12}
          text-anchor={peak.x > plotRight(PLOT) - 60 ? 'end' : 'middle'}
          >{peak.label}</text
        >
      {/if}
    {/if}
  </svg>

  {#if !compact}
    <figcaption>
      Altitude of {model.object.name}, local noon to noon. Shading is twilight;
      the filled band is your horizon along the object's azimuth.
    </figcaption>
  {/if}
</figure>

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

  .compact svg {
    border-radius: 5px;
  }

  /*
   * On a phone the full chart scaled to the panel width would squeeze a
   * 24-hour axis into ~300px, where the hour labels stop being readable at
   * all. Give it a floor and let the figure scroll sideways instead — the
   * thumbnails are exempt, they are meant to be read as a shape, not a scale.
   */
  @media (max-width: 600px) {
    .chart:not(.compact) {
      overflow-x: auto;
    }

    .chart:not(.compact) svg {
      min-width: 480px;
    }
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

  .horizon-fill {
    fill: var(--chart-horizon-fill);
  }

  .horizon-line {
    fill: none;
    stroke: var(--chart-horizon-line);
    stroke-width: 1.5;
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

  figcaption {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
</style>
