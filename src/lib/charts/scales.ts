/**
 * Projection helpers shared by the charts.
 *
 * Everything here is pure geometry over an SVG user-space box: no Svelte, no
 * astronomy. The charts declare a `PlotArea` — the rectangle inside the axis
 * labels — and map times and altitudes into it.
 */

import { windowFraction } from '../astro/time'
import type { TimeWindow } from '../astro/types'

/** The drawable rectangle of a chart, in SVG user units. */
export interface PlotArea {
  left: number
  top: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Top of the altitude axis. The charts show the sky above the horizon only. */
export const MAX_ALTITUDE = 90

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function plotRight(plot: PlotArea): number {
  return plot.left + plot.width
}

export function plotBottom(plot: PlotArea): number {
  return plot.top + plot.height
}

/**
 * Altitude (degrees) to a y coordinate, 0° at the bottom edge.
 *
 * Altitudes outside 0–90° are clamped rather than dropped, so an object that
 * sets simply runs along the baseline instead of leaving a gap in the curve —
 * which is how the reference rendering draws it.
 */
export function altitudeToY(
  altitude: number,
  plot: PlotArea,
  maxAltitude: number = MAX_ALTITUDE,
): number {
  const fraction = clamp(altitude, 0, maxAltitude) / maxAltitude
  return plotBottom(plot) - fraction * plot.height
}

/**
 * Time to an x coordinate across the window.
 *
 * Clamped to the plot edges: sun-event times can land a hair outside the
 * window after refinement, and a band drawn from a negative x would bleed
 * under the axis labels.
 */
export function timeToX(
  time: Date,
  window: TimeWindow,
  plot: PlotArea,
): number {
  const fraction = clamp(windowFraction(window, time), 0, 1)
  return plot.left + fraction * plot.width
}

/** An open polyline through the points, as an SVG path `d`. */
export function polylinePath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
    .join(' ')
}

/**
 * A filled region between the points and a baseline — used for the horizon
 * silhouette, which is a curve with everything below it filled in.
 */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return [
    polylinePath(points),
    `L${round(last.x)} ${round(baselineY)}`,
    `L${round(first.x)} ${round(baselineY)}`,
    'Z',
  ].join(' ')
}

/**
 * Clock-hour ticks across the window, every `stepHours`.
 *
 * Walks in local hours rather than by a fixed millisecond step so a DST
 * transition inside the window still yields ticks on whole local hours — the
 * labels are what the user reads off their own clock.
 */
export function hourTicks(window: TimeWindow, stepHours: number = 3): Date[] {
  const cursor = new Date(window.start)
  cursor.setMinutes(0, 0, 0)
  while (cursor < window.start || cursor.getHours() % stepHours !== 0) {
    cursor.setHours(cursor.getHours() + 1)
  }

  const ticks: Date[] = []
  while (cursor <= window.end) {
    ticks.push(new Date(cursor))
    cursor.setHours(cursor.getHours() + stepHours)
  }
  return ticks
}

/** Altitude gridline values, excluding the 0° baseline drawn as the axis. */
export function altitudeTicks(step: number = 30): number[] {
  const ticks: number[] = []
  for (let altitude = 0; altitude <= MAX_ALTITUDE; altitude += step) {
    ticks.push(altitude)
  }
  return ticks
}

/** Two decimals is well under a device pixel and keeps the markup readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}
