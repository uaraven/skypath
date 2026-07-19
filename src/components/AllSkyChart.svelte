<script lang="ts">
  /**
   * The whole sky at once: a polar dial with zenith at the centre, the
   * mathematical horizon at the rim, north up and azimuth clockwise.
   *
   * Purely presentational, like `AltitudeChart` — everything astronomical
   * arrives in `model` (`lib/charts/all-sky.ts`).
   */
  import {
    altitudeRadius,
    azimuthLabel,
    closedPath,
    compassPoint,
    markerTriangle,
    obstructionPath,
    polarPoint,
    polylinePath,
    radialPoint,
    ringAltitudes,
    spokeAzimuths,
    trajectoryAt,
    type AllSkyChartModel,
    type PolarDial,
  } from '../lib/charts'

  interface Props {
    model: AllSkyChartModel
    /**
     * Instant to flag on the track, from the Results tab's time slider. Null —
     * the default — draws no indicator; nor does a time at which the object is
     * below the rim, where the dial has nowhere to put one.
     */
    markerTime?: Date | null
  }

  let { model, markerTime = null }: Props = $props()

  const SIZE = 420
  const DIAL: PolarDial = { cx: SIZE / 2, cy: SIZE / 2, radius: 176 }
  /** Far enough out that a label clears the rim and its own tick. */
  const LABEL_RADIUS = DIAL.radius + 16

  // Per-instance, for the same reason `AltitudeChart`'s clip path is: nothing
  // stops a page from showing two of these.
  const uid = $props.id()
  const clipId = `all-sky-dial-${uid}`

  const rings = ringAltitudes()
  const spokes = spokeAzimuths()

  const arcPaths = $derived(
    model.arcs.map((arc) =>
      polylinePath(arc.map((p) => polarPoint(p.azimuth, p.altitude, DIAL))),
    ),
  )

  const clearSky = $derived(
    model.horizonProfile.map((p) => polarPoint(p.azimuth, p.altitude, DIAL)),
  )
  const obstruction = $derived(obstructionPath(clearSky, DIAL))
  const horizonLine = $derived(closedPath(clearSky))

  const marks = $derived(
    model.hourMarks.map((mark) => ({
      ...polarPoint(mark.azimuth, mark.altitude, DIAL),
      labelled: mark.labelled,
      hour: String(mark.time.getHours()).padStart(2, '0'),
    })),
  )

  const peak = $derived(
    model.peak && model.peak.altitude > 0
      ? polarPoint(model.peak.azimuth, model.peak.altitude, DIAL)
      : null,
  )

  const MARKER_SIZE = 12

  /**
   * The arcs are disjoint in time and each is cut at the rim, so trying them in
   * turn both finds the right one and rejects a moment when the object is
   * below the horizon — where the dial has no room to mark anything. Joining
   * them first would interpolate straight across the gap and park the
   * indicator on the rim for the entire time the object is down.
   */
  const marker = $derived.by(() => {
    if (!markerTime) return null

    for (const arc of model.arcs) {
      const at = trajectoryAt(arc, markerTime)
      if (at) {
        return {
          path: markerTriangle(
            polarPoint(at.azimuth, at.altitude, DIAL),
            MARKER_SIZE,
          ),
          altitude: at.altitude,
          azimuth: at.azimuth,
        }
      }
    }
    return null
  })

  const summary = $derived(
    marker
      ? `${describe(model)}; at the marked time it is at ${Math.round(marker.altitude)}° in the ${compassPoint(marker.azimuth)}`
      : describe(model),
  )

  function describe(model: AllSkyChartModel): string {
    const peak = model.peak
    if (!peak || peak.altitude <= 0) {
      return `${model.object.name}: stays below the horizon all night`
    }
    const direction = compassPoint(peak.azimuth)
    const clears = model.everClears ? '' : ', but never clears your horizon'
    return `${model.object.name}: peaks at ${Math.round(peak.altitude)}° in the ${direction}${clears}`
  }
</script>

<figure class="chart">
  <svg
    viewBox="0 0 {SIZE} {SIZE}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label={summary}
  >
    <title>{summary}</title>

    <defs>
      <clipPath id={clipId}>
        <circle cx={DIAL.cx} cy={DIAL.cy} r={DIAL.radius} />
      </clipPath>
    </defs>

    <circle class="dial" cx={DIAL.cx} cy={DIAL.cy} r={DIAL.radius} />

    <g clip-path="url(#{clipId})">
      {#each rings as altitude (altitude)}
        <circle
          class="grid"
          cx={DIAL.cx}
          cy={DIAL.cy}
          r={altitudeRadius(altitude, DIAL)}
        />
      {/each}

      {#each spokes as azimuth (azimuth)}
        <line
          class="grid"
          x1={DIAL.cx}
          y1={DIAL.cy}
          x2={radialPoint(azimuth, DIAL.radius, DIAL).x}
          y2={radialPoint(azimuth, DIAL.radius, DIAL).y}
        />
      {/each}

      {#each arcPaths as d, i (i)}
        <path class="trajectory" {d} />
      {/each}

      <!-- The obstruction sits *over* the track on purpose: an object behind
           the tree line is drawn dimmed rather than hidden, so you can see
           where it goes while it is blocked. -->
      <path class="horizon-fill" d={obstruction} fill-rule="evenodd" />
      <path class="horizon-line" d={horizonLine} />

      {#each marks as mark, i (i)}
        <circle
          class="hour"
          class:labelled={mark.labelled}
          cx={mark.x}
          cy={mark.y}
          r={mark.labelled ? 3.5 : 2}
        />
      {/each}

      {#if peak}
        <circle class="peak" cx={peak.x} cy={peak.y} r={5} />
      {/if}

      {#if marker}
        <path class="marker" d={marker.path} />
      {/if}
    </g>

    {#each marks as mark, i (i)}
      {#if mark.labelled}
        <text
          class="label hour-label"
          x={mark.x}
          y={mark.y - 8}
          text-anchor="middle">{mark.hour}</text
        >
      {/if}
    {/each}

    <circle class="frame" cx={DIAL.cx} cy={DIAL.cy} r={DIAL.radius} />

    {#each spokes as azimuth (azimuth)}
      <text
        class="label azimuth-label"
        class:cardinal={azimuth % 90 === 0}
        x={radialPoint(azimuth, LABEL_RADIUS, DIAL).x}
        y={radialPoint(azimuth, LABEL_RADIUS, DIAL).y}
        text-anchor="middle"
        dominant-baseline="middle">{azimuthLabel(azimuth)}</text
      >
    {/each}
  </svg>

  <figcaption>
    The whole sky from directly overhead: centre is the zenith, the rim is the
    horizon, north is up. The shaded ring is your horizon; dots mark whole hours
    along the track.
  </figcaption>
</figure>

<style>
  .chart {
    margin: 0;
  }

  svg {
    display: block;
    width: 100%;
    max-width: 420px;
    height: auto;
    margin-inline: auto;
    /* Framed like the altitude chart, so the two sit together in Results. */
    background-color: var(--bg-inset);
    border-radius: var(--radius-card);
  }

  .dial {
    fill: var(--sky-night);
  }

  .grid {
    fill: none;
    stroke: var(--chart-grid);
    stroke-width: 1;
  }

  .frame {
    fill: none;
    stroke: var(--border);
    stroke-width: 1.5;
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

  .hour {
    fill: var(--chart-trajectory);
    opacity: 0.7;
  }

  .hour.labelled {
    opacity: 1;
  }

  .peak {
    fill: var(--text);
  }

  .marker {
    fill: var(--chart-marker);
  }

  .label {
    fill: var(--chart-label);
    font-family: var(--font-mono);
    font-size: 13px;
  }

  .azimuth-label.cardinal {
    fill: var(--text);
    font-size: 15px;
  }

  .hour-label {
    font-size: 11px;
  }

  figcaption {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
</style>
