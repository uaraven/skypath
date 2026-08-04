# Implementation plan — yearly altitude widget

## Goal restated

On the Results tab, below the All-sky view panel, add a third chart: the
selected object's altitude sampled at **local midnight on every Monday of the
year**, plotted with **months (Jan–Dec) across** and **altitude (0–90°) up**.
No horizon, no Moon overlay, no twilight bands — just the seasonal shape of
"how high does this get around midnight."

**"Search results" here means the Results tab (`ResultsPanel.svelte`)**, the
single-object detail view that already hosts `AltitudeChart` and
`AllSkyChart` — not the per-row thumbnails in the search list
(`ObjectSearch.svelte`), which use a `compact` `AltitudeChart` only and have
no all-sky chart to sit "below." Flag if that's not what you meant.

## What I'm reusing vs. building new

The astronomy is nothing new — `horizontalAt(object, time, location)`
(`src/lib/astro/ephemeris.ts`) already gives altitude/azimuth for any
`SkyObject` (deep-sky via the `DefineStar` slot, planets/Moon via their own
`Body`) at an arbitrary instant, which is all a single midnight sample needs.
The geometry helpers in `src/lib/charts/scales.ts` (`polylinePath`,
`altitudeToY`, `altitudeTicks`) apply unchanged. What's missing is (a) a
sampler that walks Mondays instead of a 5-minute night grid, and (b) an x-axis
that spans a year instead of a noon→noon window.

## Design decisions

1. **New sampler: `src/lib/astro/yearly.ts`.**

   ```ts
   export function mondayMidnights(year: number): Date[]
   export function periodicMidnights(year: number, stepDays: number): Date[]
   export function yearlyAltitudeSamples(
     object: SkyObject,
     location: GeoLocation,
     year: number,
     stepDays?: number,
   ): TrajectoryPoint[]
   ```

   `mondayMidnights` walks from the first Monday on/after Jan 1 in 7-day
   steps (`setDate` + `setHours(0,0,0,0)` per step, same DST-safe pattern
   `nightWindow` uses) until past Dec 31 — 52 or 53 points depending on the
   year; it's `periodicMidnights(year, 7)` anchored specifically to Monday,
   kept as its own named export since "every Monday" is how the requirement
   was stated. `periodicMidnights` is the general form used for the Moon
   (decision 5 below): local midnight of Jan 1, then every `stepDays` days
   until past Dec 31, no day-of-week anchoring — a 3-day cadence has no
   natural weekday to anchor to anyway. `yearlyAltitudeSamples` maps whichever
   set of instants to `{ time, ...horizontalAt(object, time, location) }`,
   apparent convention (default), for consistency with the other two charts'
   curves.

2. **Which year, and why it can visibly flip.** The widget shows the
   **calendar year of the currently selected observing date**
   (`date.getFullYear()`), recomputed reactively. Scrubbing the date picker
   from Dec 31 to Jan 1 therefore swaps the entire curve to next year's — a
   real consequence of "months Jan to Dec" rather than a rolling 12 months
   from `date`, worth confirming you want.

3. **New model: `src/lib/charts/yearly.ts`.**

   ```ts
   export interface YearlyChartModel {
     object: SkyObject
     year: number
     points: readonly TrajectoryPoint[]   // one per sampled Monday
     peak: TrajectoryPoint | null         // highest sample of the year
     current: TrajectoryPoint | null      // sample nearest the selected date
   }
   export function yearlyChartModel(input: {
     object: SkyObject
     location: GeoLocation
     year: number
     date?: Date // for the "current" marker
   }): YearlyChartModel
   export function monthTicks(year: number): { time: Date; label: string }[]
   ```

   Deliberately thin next to `altitudeChartModel` — no `skyBands`, no
   `horizonTrack`, no `moon` field, because none of that was asked for and
   the object doesn't move fast enough over a week for a horizon track to
   mean anything here anyway. `monthTicks` returns the 1st of each month, for
   x-axis labels — a sibling of `hourTicks` but calendar- rather than
   clock-stepped, so it stays in `scales.ts`... actually it's year-specific
   (needs the year), so it lives next to `yearlyChartModel` instead, not in
   the generic `scales.ts`.

   `yearlyChartModel` is where the Moon's 3-day cadence (decision 5) gets
   picked instead of the default 7 — the one `object.id === MOON.id` branch
   in the whole feature, mirroring how `model.ts` already branches on the
   Moon for its own reasons.

   X-axis mapping reuses `timeToX`, which takes any `TimeWindow`; I'll build
   one as `{ start: Jan 1 local midnight, end: next Jan 1 local midnight,
   midnight: Jul 2 }` — the `midnight` field is unused by `timeToX`, filled
   only to satisfy the type.

4. **"You are here" marker.** I'm proposing a filled dot (+ thin vertical
   guide) on the point nearest the selected date, the same visual language as
   the peak dot on `AltitudeChart` — it's what makes the chart answer "is now
   a good time of year for this object" at a glance, not just "here's a
   shape." Not explicitly requested; drop it if you'd rather keep the chart
   to exactly the curve.

5. **One special case, decided: the Moon samples every 3 days instead of 7.**
   Weekly sampling beats badly against the Moon's ~27.3-day cycle (7 days is
   uncomfortably close to a 1/4-cycle alias); a 3-day step gives ~9.1 samples
   per lunar cycle, which is enough to actually resolve the cycle rather than
   alias it into a false low-frequency wobble. This is purely a sampling-rate
   choice (`yearlyAltitudeSamples(object, location, year, object.id === MOON.id
   ? 3 : 7)` from the model), not a different code path — `periodicMidnights`
   handles both cadences. Consequence worth noting: the Moon's curve carries
   **~122 points instead of 52**, so `YearlyChart` can't assume a fixed point
   count anywhere (it doesn't need to — `polylinePath` and the tick logic are
   already point-count-agnostic). Every other object kind keeps the weekly
   Monday cadence.

6. **New component: `src/components/YearlyChart.svelte`**, structurally a
   trimmed `AltitudeChart.svelte`: fixed viewBox (~960×260 — shorter, since
   there's no header band of compass letters to reserve), plot frame, y-axis
   altitude ticks/labels, x-axis month labels, one `polylinePath` trajectory,
   a peak dot, the current-date marker. No click-to-scrub (it isn't on the
   shared night timeline — a different axis entirely), no `compact` mode
   (single instance, not a per-row thumbnail).

7. **Wiring — `ResultsPanel.svelte`.** A third `<section class="panel">`
   after "All-sky view", before "Times and directions":

   ```svelte
   const yearlyModel = $derived(
     object
       ? yearlyChartModel({ object, location, year: date.getFullYear(), date })
       : null,
   )
   ```

   ```svelte
   <section class="panel">
     <h3>Yearly altitude</h3>
     <YearlyChart model={yearlyModel} />
   </section>
   ```

   Heading text is a placeholder — "Yearly altitude" / "Altitude through the
   year" / "Best time of year" all read fine; say which you want.

## Tests

- **Unit** (`src/lib/astro/yearly.test.ts`): `mondayMidnights` — count for a
  known year, all entries actually Mondays at `00:00` local, first ≥ Jan 1,
  last ≤ Dec 31 + 6 days; a year-boundary case (Dec 31 is a Monday).
  `yearlyAltitudeSamples` — one point per Monday, altitude matches
  `horizontalAt` directly for a spot-checked date.
- **Unit** (`src/lib/charts/yearly.test.ts`): `monthTicks` returns 12 ticks
  labelled Jan…Dec at the right x fractions; `yearlyChartModel` picks the
  right `peak`; `current` resolves to the sample nearest an arbitrary `date`;
  an always-below-horizon object still returns a flat curve (no throw, no
  filtering — same "clamped, not dropped" convention as `altitudeToY`).
- **Components** (`src/components/YearlyChart.test.ts`): renders a single
  trajectory path for 52/53 points; no `.horizon-*` or `.moon-track` elements
  exist (asserting the "no horizon or moon" requirement stays true, not just
  true today); month labels present; peak and current markers render when
  present, absent when null.
- **Components** (`ResultsPanel.test.ts`): new panel appears under "All-sky
  view" for a selected object and is absent when nothing is selected;
  changing the date across a year boundary changes which year is shown.

## Docs

- `CLAUDE.md`: add `yearly.ts` to the `src/lib/astro/` and `src/lib/charts/`
  bullets, and `YearlyChart` to the `src/components/` bullet listing the
  Results-tab pieces.
- `.plan/state.md`: dated log entry once built, covering the "which year"
  and Moon-aliasing decisions above so they don't need re-deriving later.

## Decided

1. Results tab (`ResultsPanel.svelte`), below "All-sky view" — confirmed.
2. Keep the "you are here" marker (decision 4).
3. Calendar year of the selected date, flip-at-New-Year's and all (decision 2).
4. Moon included, sampled every 3 days instead of weekly to avoid aliasing
   against its ~27.3-day cycle (decision 5).
5. Panel heading: **"Yearly altitude."**

Ready to build against this plan.
