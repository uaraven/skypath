import { describe, expect, it } from 'vitest'
import { moonPhasePath } from './moon-glyph'

describe('moonPhasePath', () => {
  it('draws a straight terminator (zero-width ellipse) at the quarters', () => {
    // Half lit: the terminator collapses to a line, so the lit face is a clean
    // half-disc. The second arc — the terminator — has an x-radius of 0.
    expect(moonPhasePath(0, 0, 10, 0.5, true)).toContain('A0 10 0 0')
  })

  it('grows the terminator back to the full radius at new and full', () => {
    expect(moonPhasePath(0, 0, 10, 0, true)).toContain('A10 10 0 0')
    expect(moonPhasePath(0, 0, 10, 1, true)).toContain('A10 10 0 0')
  })

  it('lights opposite limbs for waxing and waning', () => {
    const waxing = moonPhasePath(0, 0, 10, 0.3, true)
    const waning = moonPhasePath(0, 0, 10, 0.3, false)
    // The bright-limb arc is the first one after the opening move.
    expect(waxing).toMatch(/M0 -10 A10 10 0 0 1 /)
    expect(waning).toMatch(/M0 -10 A10 10 0 0 0 /)
  })
})
