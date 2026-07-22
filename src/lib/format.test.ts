import { describe, expect, it } from 'vitest'
import { formatClock, formatHour } from './format'

// The test env runs under en-US, whose default is a 12-hour am/pm clock; under a
// 24-hour locale the same calls would print `20:06` / `18`. The exact am/pm token
// is ICU's to spell — `PM` or `p.m.`, plain or narrow-nbsp-separated, varies by
// CLDR version — so we normalise that away and assert the en-US semantics.
const norm = (s: string | null) =>
  (s ?? '').replace(/\s+/g, ' ').replace(/\./g, '').toUpperCase()

describe('formatClock', () => {
  it('prints the local clock in the locale format', () => {
    expect(norm(formatClock(new Date(2026, 9, 15, 20, 6)))).toBe('08:06 PM')
  })

  it('pads the hour and minute to two digits', () => {
    expect(norm(formatClock(new Date(2026, 9, 15, 8, 5)))).toBe('08:05 AM')
  })

  it('shows midnight in the locale clock', () => {
    expect(norm(formatClock(new Date(2026, 9, 15, 0, 0)))).toBe('12:00 AM')
  })

  it('uses the locale am/pm clock in the afternoon', () => {
    expect(norm(formatClock(new Date(2026, 9, 15, 13, 30)))).toBe('01:30 PM')
  })
})

describe('formatHour', () => {
  it('prints the local whole hour in the locale format', () => {
    expect(norm(formatHour(new Date(2026, 9, 15, 8, 59)))).toBe('08 AM')
  })

  it('ignores the minutes', () => {
    expect(norm(formatHour(new Date(2026, 9, 15, 20, 6)))).toBe('08 PM')
  })

  it('shows midnight as 12 AM', () => {
    expect(norm(formatHour(new Date(2026, 9, 15, 0, 30)))).toBe('12 AM')
  })

  it('renders the same am/pm token as the full clock, matching the axis', () => {
    const time = new Date(2026, 9, 15, 20, 6)
    const period = /(AM|PM)$/
    const hour = norm(formatHour(time))
    expect(hour).toMatch(period)
    expect(norm(formatClock(time)).match(period)?.[0]).toBe(
      hour.match(period)?.[0],
    )
  })
})
