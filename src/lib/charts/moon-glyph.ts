/**
 * The lit face of the Moon as an SVG path, for the phase glyph on the charts.
 *
 * Pure geometry over an SVG user-space box, like the rest of this directory:
 * no Svelte, no astronomy. The caller draws the full disc as the unlit side and
 * paints this path on top as the lit side.
 */

/**
 * The illuminated region of a disc of radius `r` centred at `(cx, cy)`.
 *
 * The lit face is bounded by two arcs meeting at the poles: the bright limb —
 * a semicircle down one side — and the terminator, a half-ellipse whose width
 * shrinks to nothing at the quarters (a straight line, so a clean half-disc)
 * and grows back to the full radius at new and full. Past half-lit the
 * terminator bulges the other way, turning the crescent into a gibbous face.
 *
 * `illumination` is the lit fraction 0–1; `waxing` puts the bright limb on the
 * right, the way a waxing Moon is lit.
 */
export function moonPhasePath(
  cx: number,
  cy: number,
  r: number,
  illumination: number,
  waxing: boolean,
): string {
  const lit = Math.min(Math.max(illumination, 0), 1)
  // Signed half-width of the terminator: +r at new, 0 at the quarters, −r at
  // full. Its sign is what flips the terminator from crescent to gibbous.
  const rx = r * (1 - 2 * lit)

  const top = `${round(cx)} ${round(cy - r)}`
  const bottom = `${round(cx)} ${round(cy + r)}`

  // The bright limb: the right semicircle when waxing, the left when waning.
  const limbSweep = waxing ? 1 : 0
  // The terminator returns to the top; its sweep flips once the face is more
  // than half lit, so the ellipse bulges across the centre instead of short of it.
  const termSweep = rx >= 0 ? limbSweep : 1 - limbSweep

  return [
    `M${top}`,
    `A${round(r)} ${round(r)} 0 0 ${limbSweep} ${bottom}`,
    `A${round(Math.abs(rx))} ${round(r)} 0 0 ${termSweep} ${top}`,
    'Z',
  ].join(' ')
}

/** Two decimals is well under a device pixel and keeps the markup readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}
