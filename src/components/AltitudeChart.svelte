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
    clamp,
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
  import { formatClock, formatHour } from '../lib/format'
  import MoonGlyph from './MoonGlyph.svelte'

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
    /**
     * Called with a click's position as minutes from the start of the window,
     * so the Results tab can scrub the shared marker to where the chart was
     * clicked. Omitted — the default — leaves the chart non-interactive.
     */
    onScrub?: (minutes: number) => void
  }

  let { model, compact = false, markerTime = null, onScrub }: Props = $props()

  const interactive = $derived(!compact && !!onScrub)

  const WIDTH = $derived(compact ? 420 : 960)
  const HEIGHT = $derived(compact ? 96 : 400)
  // The full chart keeps a tall top margin — the header band — so the compass
  // row and a near-zenith transit label sit above the plot without clipping at
  // the viewBox edge or reaching down into the plotted area.
  const PLOT: PlotArea = $derived(
    compact
      ? { left: 0, top: 0, width: 420, height: 96 }
      : { left: 46, top: 58, width: 900, height: 296 },
  )

  /** Text baseline for the compass row, near the top of the header band. */
  const CARDINAL_Y = 20
  /** Transit labels never rise above this, keeping them clear of the compass row. */
  const TRANSIT_LABEL_FLOOR = 40

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

  const moonPath = $derived(
    model.moon ? polylinePath(model.moon.points.map(toPoint)) : null,
  )

  /** The phase disc sits at the Moon's high point, when it is above the horizon. */
  const moonGlyph = $derived.by(() => {
    const peak = model.moon?.peak
    if (!model.moon || !peak || peak.altitude <= 0) return null
    return {
      x: timeToX(peak.time, model.window, PLOT),
      y: altitudeToY(peak.altitude, PLOT),
      illumination: model.moon.illumination,
      waxing: model.moon.waxing,
    }
  })

  const horizonPoints = $derived(model.horizonTrack.map(toPoint))
  const horizonFill = $derived(areaPath(horizonPoints, baseline))
  const horizonLine = $derived(polylinePath(horizonPoints))

  const times = $derived(hourTicks(model.window))
  const altitudes = altitudeTicks()

  const cardinals = $derived(
    model.cardinals.map((crossing) => ({
      x: timeToX(crossing.time, model.window, PLOT),
      label: crossing.label,
    })),
  )

  // The window runs local noon → noon, so its first and last ticks fall on two
  // different calendar days; dating just those two anchors the axis without
  // repeating the date under every hour.
  const dateTicks = $derived.by(() => {
    if (times.length === 0) return []
    const ends = [times[0], times[times.length - 1]].filter(
      (time, i, all) => i === 0 || time.getTime() !== all[0].getTime(),
    )
    return ends.map((time, i) => ({
      x: timeToX(time, model.window, PLOT),
      label: formatDate(time),
      // Anchor the ends inward — the last date sits at the plot's right edge, so
      // centring it would push half the text past the viewBox and clip it.
      anchor: ends.length > 1 && i === ends.length - 1 ? 'end' : 'start',
    }))
  })

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
        ? `${model.object.name}: peaks at ${peak.label} at ${formatClock(peak.time)}`
        : `${model.object.name}: stays below the horizon all night`,
      marker &&
        `at ${formatClock(marker.time)} it is at ${Math.round(marker.altitude)}°`,
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

  function formatDate(time: Date): string {
    return time.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })
  }

  /**
   * Turn a click anywhere on the plot into a moment of the night. The click is
   * mapped from screen space back into the viewBox so it works at any rendered
   * size, then read across the plot as a fraction of the window.
   */
  function scrubTo(svg: SVGSVGElement, event: MouseEvent) {
    if (!onScrub) return
    const ctm = svg.getScreenCTM()
    if (!ctm) return

    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const userX = point.matrixTransform(ctm.inverse()).x

    const fraction = clamp((userX - PLOT.left) / PLOT.width, 0, 1)
    const spanMs = model.window.end.getTime() - model.window.start.getTime()
    onScrub(Math.round((fraction * spanMs) / 60000))
  }

  /**
   * Clicking the plot scrubs the shared time marker. Attached as an action
   * rather than an `onclick` so the chart stays a plain non-interactive image
   * for a11y — the range slider beside it is the keyboard-accessible path — and
   * the listener is simply absent when the chart isn't interactive.
   */
  function scrubbable(svg: SVGSVGElement) {
    const handler = (event: MouseEvent) => scrubTo(svg, event)
    svg.addEventListener('click', handler)
    return {
      destroy() {
        svg.removeEventListener('click', handler)
      },
    }
  }
</script>

<figure class="chart" class:compact>
  <svg
    viewBox="0 0 {WIDTH} {HEIGHT}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={summary}
    class:interactive
    use:scrubbable
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
      {#if moonPath}
        <path class="moon-track" d={moonPath} />
      {/if}
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

    <!-- Outside the clip so a high Moon's disc stays whole rather than shaved
         by the plot's top edge. -->
    {#if moonGlyph}
      <MoonGlyph
        cx={moonGlyph.x}
        cy={moonGlyph.y}
        r={8}
        illumination={moonGlyph.illumination}
        waxing={moonGlyph.waxing}
      />
    {/if}

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

      {#each dateTicks as tick, i (i)}
        <text
          class="label date-label"
          x={tick.x}
          y={baseline + 38}
          text-anchor={tick.anchor}>{tick.label}</text
        >
      {/each}

      {#each cardinals as cardinal, i (i)}
        <text
          class="label cardinal-label"
          x={cardinal.x}
          y={CARDINAL_Y}
          text-anchor="middle">{cardinal.label}</text
        >
      {/each}

      {#if peak}
        <text
          class="label peak-label"
          x={peak.x}
          y={Math.max(peak.y - 12, TRANSIT_LABEL_FLOOR)}
          text-anchor={peak.x > plotRight(PLOT) - 60 ? 'end' : 'middle'}
          >{peak.label}</text
        >
      {/if}
    {/if}
  </svg>
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

  svg.interactive {
    cursor: pointer;
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

  .moon-track {
    fill: none;
    stroke: var(--chart-moon);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
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

  .cardinal-label {
    fill: var(--text-dim);
    font-size: 13px;
  }

  .date-label {
    font-size: 12px;
    fill: var(--chart-label);
  }
</style>
