/**
 * Everything the yearly-altitude chart draws, computed in one place.
 *
 * Same split as `model.ts` and `all-sky.ts`: the astronomy happens here so
 * the Svelte component stays presentational. Deliberately thin next to those
 * two — there's no horizon, no Moon overlay and no twilight bands here, since
 * none of that was asked for.
 */

import { yearlyAltitudeSamples } from '../astro/yearly'
import type {
  GeoLocation,
  SkyObject,
  TimeWindow,
  TrajectoryPoint,
} from '../astro/types'
import { peakAltitude, type Trajectory } from '../astro/trajectory'

/** A tick on the month axis: the 1st of the month, local midnight. */
export interface MonthTick {
  time: Date
  label: string
}

export interface YearlyChartModel {
  object: SkyObject
  year: number
  /** One point per day of the year, sampled at local midnight. */
  points: readonly TrajectoryPoint[]
  /** Highest sampled point, or null if the object never rises all year. */
  peak: TrajectoryPoint | null
  /** The sample closest to the caller's reference date, for the "you are here" marker. */
  current: TrajectoryPoint | null
}

export interface YearlyChartInput {
  object: SkyObject
  location: GeoLocation
  year: number
  /** Reference date used to pick `current`. Omit to leave it null. */
  date?: Date
}

const MONTH_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short' })

/** The 1st of each month of `year`, local midnight, for the x-axis labels. */
export function monthTicks(year: number): MonthTick[] {
  const ticks: MonthTick[] = []
  for (let month = 0; month < 12; month++) {
    const time = new Date(year, month, 1)
    ticks.push({ time, label: MONTH_FORMAT.format(time) })
  }
  return ticks
}

export function yearlyChartModel({
  object,
  location,
  year,
  date,
}: YearlyChartInput): YearlyChartModel {
  const points = yearlyAltitudeSamples(object, location, year)
  const trajectory: Trajectory = { object, window: yearWindow(year), points }

  return {
    object,
    year,
    points,
    peak: peakAltitude(trajectory),
    current: date ? nearestSample(points, date) : null,
  }
}

/** The span of `year` as a `TimeWindow`, so `timeToX` can project onto it. */
export function yearWindow(year: number): TimeWindow {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
    // Unused by `timeToX`/`windowFraction`; filled only to satisfy the type.
    midnight: new Date(year, 6, 2),
  }
}

function nearestSample(
  points: readonly TrajectoryPoint[],
  date: Date,
): TrajectoryPoint | null {
  if (points.length === 0) return null
  const target = date.getTime()
  return points.reduce((closest, point) =>
    Math.abs(point.time.getTime() - target) <
    Math.abs(closest.time.getTime() - target)
      ? point
      : closest,
  )
}
