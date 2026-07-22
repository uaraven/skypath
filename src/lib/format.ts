/**
 * Formatting the local clock the same way everywhere it is shown.
 *
 * The times panel, the altitude chart's axis and its caption, and the all-sky
 * chart's hour marks all print the local clock, and they must agree: an axis
 * tick labelled 20 sitting above a caption that read "08:06 PM" would be asking
 * the reader to convert. Three components had grown three copies of the same
 * padding; this is the one copy.
 *
 * We follow the viewer's locale rather than forcing a convention: a 12-hour
 * locale (e.g. en-US) sees `08:06 PM` / `08 PM`, a 24-hour one (e.g. en-GB)
 * sees `20:06` / `18`, and both read their own numbering system. Because every
 * clock string comes from here, the whole app switches together.
 */

const clockFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
})

/** Local time as `HH:MM` (plus am/pm in a 12-hour locale), e.g. `20:06`. */
export function formatClock(time: Date): string {
  return clockFormat.format(time)
}

/**
 * Local whole hour — the altitude axis and all-sky hour marks label hours
 * only. Built from `clockFormat`'s own parts with the minutes dropped, rather
 * than a separate hour-only formatter: an `{ hour }` skeleton can resolve to a
 * different am/pm rendering than `{ hour, minute }` (e.g. `8 p.m.` vs `PM`), and
 * the axis must read the same as the caption beside it. So this yields `18` in a
 * 24-hour locale, `08 PM` / `12 AM` in a 12-hour one. The chart geometry is
 * projected from the `Date` itself, not from this string, so the label still
 * sits on the tick it names.
 */
export function formatHour(time: Date): string {
  const parts = clockFormat.formatToParts(time)
  const minute = parts.findIndex((part) => part.type === 'minute')
  if (minute === -1) return clockFormat.format(time)
  // Drop the minute and the hour:minute separator sitting just before it.
  return parts
    .filter((_, i) => i !== minute && i !== minute - 1)
    .map((part) => part.value)
    .join('')
    .trim()
}
