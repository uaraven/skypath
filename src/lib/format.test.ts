import { describe, expect, it } from 'vitest'
import { formatClock, formatHour } from './format'

describe('formatClock', () => {
  it('prints a local 24-hour HH:MM clock', () => {
    expect(formatClock(new Date(2026, 9, 15, 20, 6))).toBe('20:06')
  })

  it('pads the hour and minute to two digits', () => {
    expect(formatClock(new Date(2026, 9, 15, 8, 5))).toBe('08:05')
  })

  it('shows midnight as 00:00, not 24:00', () => {
    expect(formatClock(new Date(2026, 9, 15, 0, 0))).toBe('00:00')
  })

  it('does not switch to a 12-hour clock in the afternoon', () => {
    expect(formatClock(new Date(2026, 9, 15, 13, 30))).toBe('13:30')
  })
})

describe('formatHour', () => {
  it('prints the local hour as two digits', () => {
    expect(formatHour(new Date(2026, 9, 15, 8, 59))).toBe('08')
  })

  it('ignores the minutes', () => {
    expect(formatHour(new Date(2026, 9, 15, 20, 6))).toBe('20')
  })

  it('shows midnight as 00', () => {
    expect(formatHour(new Date(2026, 9, 15, 0, 30))).toBe('00')
  })
})
