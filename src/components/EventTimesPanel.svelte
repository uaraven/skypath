<script lang="ts">
  /**
   * The night's times: the object's own, the sun's, and the moon's.
   *
   * Presentational, like the charts — it formats a `NightEvents` and does no
   * astronomy. What it does decide is what to say when an event does not
   * happen, which is most of the work: "circumpolar" and "never rises" are
   * answers, and printing a dash for both would lose the difference.
   */
  import type { NightEvents } from '../lib/astro/events'
  import type { TrajectoryPoint } from '../lib/astro/types'
  import { compassPoint } from '../lib/charts'
  import { formatClock } from '../lib/format'

  interface Props {
    events: NightEvents
    /** Hides the observer-horizon rows, which duplicate rise/set when flat. */
    horizonIsFlat?: boolean
  }

  let { events, horizonIsFlat = false }: Props = $props()

  interface Row {
    label: string
    time: Date | null
    point?: TrajectoryPoint | null
    /** Shown in place of a time when the event does not occur. */
    absent?: string
  }

  /**
   * The window runs noon→noon, so everything after midnight falls on the next
   * calendar day. Marking those keeps a 05:12 sunrise from reading as an
   * evening time in a list that starts at 16:00.
   */
  function isNextDay(time: Date): boolean {
    return time.getDate() !== events.window.start.getDate()
  }

  function direction(point: TrajectoryPoint | null | undefined): string | null {
    if (!point) return null
    return `${compassPoint(point.azimuth)} ${Math.round(point.azimuth)}°`
  }

  const target = $derived(events.target)

  const objectRows = $derived.by<Row[]>(() => {
    const rows: Row[] = []
    // One phrase has to sit on both the rise and the set row, so it says what
    // the object does rather than which event is missing: "never sets" would
    // be a strange answer to print against "Rises".
    const absent = target.circumpolar
      ? 'circumpolar — always up'
      : target.neverRises
        ? 'never rises'
        : undefined

    rows.push({
      label: 'Rises (0°)',
      time: target.rise?.time ?? null,
      point: target.rise,
      absent,
    })

    if (!horizonIsFlat) {
      rows.push({
        label: 'Above horizon',
        time: target.clears?.time ?? null,
        point: target.clears,
        absent: target.everClears ? 'already clear' : 'stays blocked',
      })
    }

    rows.push({
      label: 'Highest',
      time: target.transit?.time ?? null,
      point: target.transit,
      absent: 'no transit tonight',
    })

    if (!horizonIsFlat) {
      rows.push({
        label: 'Below horizon',
        time: target.hides?.time ?? null,
        point: target.hides,
        absent: target.everClears ? 'still clear' : 'stays blocked',
      })
    }

    rows.push({
      label: 'Sets (0°)',
      time: target.set?.time ?? null,
      point: target.set,
      absent,
    })

    return rows
  })

  const sunAbsent = $derived(
    events.sun.polarDay
      ? 'polar day — sun never sets'
      : events.sun.polarNight
        ? 'polar night — sun never rises'
        : 'does not occur tonight',
  )

  const sunRows = $derived.by<Row[]>(() => {
    const { sun } = events
    return [
      { label: 'Sunset', time: sun.sunset },
      { label: 'Civil dusk', time: sun.twilight.civil.dusk },
      { label: 'Nautical dusk', time: sun.twilight.nautical.dusk },
      { label: 'Astronomical dusk', time: sun.twilight.astronomical.dusk },
      { label: 'Astronomical dawn', time: sun.twilight.astronomical.dawn },
      { label: 'Nautical dawn', time: sun.twilight.nautical.dawn },
      { label: 'Civil dawn', time: sun.twilight.civil.dawn },
      { label: 'Sunrise', time: sun.sunrise },
    ].map((row) => ({ ...row, absent: sunAbsent }))
  })

  const moonRows = $derived.by<Row[]>(() => [
    {
      label: 'Moonrise',
      time: events.moon.rise?.time ?? null,
      point: events.moon.rise,
      absent: 'does not rise tonight',
    },
    {
      label: 'Moonset',
      time: events.moon.set?.time ?? null,
      point: events.moon.set,
      absent: 'does not set tonight',
    },
  ])

  const illuminationPercent = $derived(
    Math.round(events.moon.illumination * 100),
  )

  /**
   * When the Moon itself is the target, its rise/set already appear in the
   * object group (and via the same `SearchRiseSet` the Moon rows would use), so
   * a second "Moon" group would only duplicate them — and collide on the key.
   * The phase row is folded into the object group instead.
   */
  const targetIsMoon = $derived(events.target.object.id === 'moon')

  const groups = $derived(
    targetIsMoon
      ? [
          { title: events.target.object.name, rows: objectRows, phase: true },
          { title: 'Sun', rows: sunRows, phase: false },
        ]
      : [
          { title: events.target.object.name, rows: objectRows, phase: false },
          { title: 'Sun', rows: sunRows, phase: false },
          { title: 'Moon', rows: moonRows, phase: true },
        ],
  )
</script>

<div class="times">
  {#each groups as group (group.title)}
    <section>
      <h4>{group.title}</h4>
      <dl>
        {#each group.rows as row (row.label)}
          <div class="row" class:absent={row.time === null}>
            <dt>{row.label}</dt>
            <dd>
              {#if row.time}
                <span class="time">{formatClock(row.time)}</span>
                {#if isNextDay(row.time)}<span
                    class="next-day"
                    title="the following day">+1</span
                  >{/if}
                {#if row.point}
                  <span class="detail">
                    {Math.round(row.point.altitude)}° · {direction(row.point)}
                  </span>
                {/if}
              {:else}
                <span class="detail">{row.absent ?? '—'}</span>
              {/if}
            </dd>
          </div>
        {/each}
        {#if group.phase}
          <div class="row">
            <dt>Phase</dt>
            <dd>
              <span class="time">{events.moon.phaseName}</span>
              <span class="detail">{illuminationPercent}% lit</span>
            </dd>
          </div>
        {/if}
      </dl>
    </section>
  {/each}
</div>

<style>
  .times {
    display: grid;
    /* 13rem is about the widest column that still lets all three groups sit
       side by side in the results panel, which is how the mock shows them.
       The theme's root font is ~18.7px, so a rem here is not 16px — 14rem
       already wraps the moon onto a second row. */
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 1.5rem;
  }

  h4 {
    color: var(--heading);
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid var(--border);
  }

  dl {
    margin: 0;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.2rem 0;
  }

  dt {
    font-size: 0.8rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  dd {
    margin: 0;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .time {
    color: var(--text);
  }

  .next-day {
    color: var(--accent-bright);
    font-size: 0.65rem;
    vertical-align: super;
  }

  .detail {
    color: var(--text-dim);
    font-size: 0.7rem;
    margin-left: 0.4rem;
    white-space: nowrap;
  }

  .absent dt {
    opacity: 0.7;
  }
</style>
