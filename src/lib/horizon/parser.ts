/**
 * Parser for NINA-compatible horizon files.
 *
 * The format is deliberately trivial — one `azimuth altitude` pair per line,
 * both in degrees:
 *
 * ```
 * 5 55
 * 20 61
 * 65 41
 * ```
 *
 * Real files come out of horizon-measuring tools and get hand-edited, so the
 * parser is permissive about separators (spaces, tabs, commas), comments
 * (`#` or `;` to end of line) and blank lines. It is *not* permissive about
 * values: a line that does not yield two in-range numbers is skipped and
 * reported, so the UI can tell the user which line to fix instead of silently
 * drawing a wrong horizon.
 */

import { Horizon, type HorizonPoint } from './horizon'

/** A line that could not be used, or was used but deserves a warning. */
export interface HorizonParseIssue {
  /** 1-based line number, matching what an editor shows. */
  line: number
  /** The offending line, trimmed, for display next to the message. */
  text: string
  message: string
}

export interface HorizonParseResult {
  /** Valid points, sorted by azimuth. */
  points: HorizonPoint[]
  issues: HorizonParseIssue[]
}

const COMMENT = /[#;].*$/
const SEPARATOR = /[\s,]+/

/** Highest altitude a horizon point may claim. Below -90 / above 90 is nonsense. */
const MIN_ALTITUDE = -90
const MAX_ALTITUDE = 90

export function parseHorizon(text: string): HorizonParseResult {
  const issues: HorizonParseIssue[] = []
  const byAzimuth = new Map<number, HorizonPoint>()

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const content = raw.replace(COMMENT, '').trim()
    if (content === '') return

    const report = (message: string) =>
      issues.push({ line, text: raw.trim(), message })

    const fields = content.split(SEPARATOR)
    if (fields.length !== 2) {
      report(`expected two numbers, found ${fields.length}`)
      return
    }

    const azimuth = Number(fields[0])
    const altitude = Number(fields[1])
    if (!Number.isFinite(azimuth) || !Number.isFinite(altitude)) {
      report('not a pair of numbers')
      return
    }
    if (azimuth < 0 || azimuth > 360) {
      report(`azimuth ${azimuth} is outside 0–360°`)
      return
    }
    if (altitude < MIN_ALTITUDE || altitude > MAX_ALTITUDE) {
      report(`altitude ${altitude} is outside ${MIN_ALTITUDE}–${MAX_ALTITUDE}°`)
      return
    }

    // A trailing 360° row is a common way of closing the loop; it is the same
    // direction as 0°, and the wrap-around interpolation already covers it.
    const key = azimuth === 360 ? 0 : azimuth

    const existing = byAzimuth.get(key)
    if (existing) {
      if (existing.altitude !== altitude) {
        report(
          `azimuth ${key}° already set to ${existing.altitude}°; keeping the first value`,
        )
      }
      return
    }

    byAzimuth.set(key, { azimuth: key, altitude })
  })

  const points = [...byAzimuth.values()].sort((a, b) => a.azimuth - b.azimuth)
  return { points, issues }
}

/**
 * Parses text straight into a `Horizon`, ignoring issues — for the render path,
 * where the text has already been validated on entry and a partial horizon
 * beats no chart at all.
 *
 * Results are memoized on the last text seen: the charts re-read the selected
 * observatory's horizon on every redraw, and re-parsing an unchanged file each
 * time is pure waste. One entry is enough because only one observatory is
 * selected at a time.
 */
export function horizonFromText(text: string): Horizon {
  if (text === lastText) return lastHorizon
  lastText = text
  lastHorizon = new Horizon(parseHorizon(text).points)
  return lastHorizon
}

let lastText: string | null = null
let lastHorizon = new Horizon()

/** Serializes points back to the NINA format, for export and round-trip tests. */
export function formatHorizon(points: readonly HorizonPoint[]): string {
  return points.map((p) => `${p.azimuth} ${p.altitude}`).join('\n')
}
