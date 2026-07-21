/**
 * Formatting the local clock the same way everywhere it is shown.
 *
 * The times panel, the altitude chart's axis and its caption, and the all-sky
 * chart's hour marks all print a local 24-hour clock, and they must agree: an
 * axis tick labelled 20 sitting above a caption that read "08:06 PM" would be
 * asking the reader to convert. Three components had grown three copies of the
 * same padding; this is the one copy.
 *
 * 24-hour regardless of the viewer's locale (`hourCycle: 'h23'`), but the
 * digits themselves still follow the locale's numbering system, so a reader in
 * an Arabic or Devanagari locale sees their own numerals.
 */

const clockFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Local time as `HH:MM` on a 24-hour clock, e.g. `20:06`. */
export function formatClock(time: Date): string {
  return clockFormat.format(time)
}

/**
 * Local hour as two digits, `00`–`23` — the altitude axis and all-sky hour
 * marks label whole hours only. Kept as bare digits (not via `Intl`) so it
 * lines up exactly with the chart geometry, which is drawn from `getHours()`.
 */
export function formatHour(time: Date): string {
  return String(time.getHours()).padStart(2, '0')
}
