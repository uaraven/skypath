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

  it('flips the terminator across the centre past half lit', () => {
    // A waxing crescent's terminator hugs the bright (right) limb, so the lit
    // sliver is a thin lune; a waxing gibbous's flips to the far side, so the
    // lit region bulges past the centre. Same |rx|, opposite sweep flag — get
    // this wrong and the glyph paints its own complement (57% lit reads as 43%).
    const crescent = moonPhasePath(0, 0, 10, 0.3, true)
    const gibbous = moonPhasePath(0, 0, 10, 0.7, true)
    // The terminator is the second arc, `A|rx| 10 …`; here |rx| = 4 for both.
    expect(crescent).toContain('A10 10 0 0 1 0 10 A4 10 0 0 0 0 -10')
    expect(gibbous).toContain('A10 10 0 0 1 0 10 A4 10 0 0 1 0 -10')
  })

  it('encloses the illuminated fraction it was given', () => {
    // The lit region is bounded by the right bright limb (+√(r²−y²)) and the
    // terminator (±|rx|·√(1−y²/r²)); integrating its width over the disc gives
    // (r ± |rx|)·½πr. Dividing by πr² recovers the illuminated fraction — proof
    // the path fills the lit side and not its complement.
    for (const lit of [0.2, 0.45, 0.55, 0.85]) {
      expect(litFraction(moonPhasePath(0, 0, 10, lit, true))).toBeCloseTo(lit, 2)
    }
  })
})

/** The lit fraction a waxing glyph path actually encloses, from its |rx|/sweep. */
function litFraction(path: string): number {
  const r = 10
  const [, rxText, sweep] = path.match(/A([\d.]+) 10 0 0 ([01]) 0 -10/)!
  const rx = Number(rxText)
  // Terminator on the far (left) half — sweep 1 for waxing — adds to the right
  // semicircle; on the near (right) half it subtracts.
  const signedRx = sweep === '1' ? rx : -rx
  const area = ((r + signedRx) * Math.PI * r) / 2
  return area / (Math.PI * r * r)
}
