/**
 * View parameters for the framing assistant: the same Aladin cutout
 * `aladin.ts` already builds, plus what the camera-frame rectangle needs to
 * draw itself.
 *
 * Pure computation, same discipline as `aladin.ts`: this decides *where the
 * view points, how wide, and how big the frame rectangle is*; the component
 * only ever sees ready-made values.
 */

import type { DeepSkyObject } from '../astro/types'
import { rigOptics, type Rig } from '../rig'
import {
  aladinViewParams,
  MAX_FIELD_DEGREES,
  MIN_FIELD_DEGREES,
  type AladinOptions,
} from './aladin'

/**
 * How much wider the view is than the rig's own field. Distinct from
 * `aladin.ts`'s `FRAMING_FACTOR` (1.5): that one answers "how much sky
 * around the object", this one answers "how much room around the sensor's
 * field", and the no-rig sky view keeps using the former unchanged.
 */
export const FRAME_MARGIN = 1.25

/**
 * The rig's own diagonal, in degrees — what the frame rectangle's on-screen
 * footprint actually is once the rotation slider is in play. Sizing the view
 * off the rig's *larger axis* (as an unrotated rectangle would suggest) is
 * not enough: the rotation slider spins the frame around the view's centre,
 * and a rectangle rotated to, say, 45° reaches out to its full diagonal in
 * every direction. Using the diagonal here is what keeps the frame inside
 * the box at *every* rotation, not just 0°.
 */
function rigDiagonalDeg(fovWidthDeg: number, fovHeightDeg: number): number {
  return Math.hypot(fovWidthDeg, fovHeightDeg)
}

export interface FramingView {
  /** "RA Dec" in decimal degrees (Aladin's ICRSd frame). */
  target: string
  /** HiPS survey id. */
  survey: string
  /** Degrees across the (square) view box. */
  fov: number
  /**
   * Fractions of the view box, 0–1 (or occasionally above 1, when the rig's
   * field is wide enough that the view clamps at `MAX_FIELD_DEGREES` — the
   * frame then genuinely overflows the box, and drawing it that way, clipped
   * by the SVG viewport, is the honest picture of "your field is wider than
   * this view"). Sized off the rig's diagonal, not its larger axis, so the
   * rectangle stays inside the box at every rotation, not just at 0°. Null
   * when no rig is selected.
   */
  frame: { width: number; height: number } | null
}

/**
 * Framing-assistant view parameters for an object, optionally through a rig.
 *
 * Without a rig, this degrades to exactly today's sky view: `aladin.ts`'s
 * object-sized field, no rectangle. With one, the view is always sized off
 * *that rig's own field* — `FRAME_MARGIN` times its diagonal (see
 * `rigDiagonalDeg`) — regardless of how big the object's catalog size is, so
 * switching rigs always changes the view, and a long focal length on a big
 * object shows a properly zoomed-in crop rather than ballooning out to fit
 * the whole object with the sensor rectangle shrunk to a sliver. The
 * diagonal, not the larger axis, is what has to fit: the rotation slider
 * spins the frame in place, and only the diagonal is rotation-invariant.
 */
export function framingViewParams(
  object: DeepSkyObject,
  rig: Rig | null,
  options: AladinOptions = {},
): FramingView {
  if (!rig) {
    const { target, fov, survey } = aladinViewParams(object, options)
    return { target, fov, survey, frame: null }
  }

  const optics = rigOptics(rig)
  const diagonal = rigDiagonalDeg(optics.fovWidthDeg, optics.fovHeightDeg)
  const fov = Math.min(
    Math.max(FRAME_MARGIN * diagonal, MIN_FIELD_DEGREES),
    MAX_FIELD_DEGREES,
  )

  const { target, survey } = aladinViewParams(object, {
    survey: options.survey,
    fieldDegrees: fov,
  })

  return {
    target,
    survey,
    fov,
    frame: {
      width: optics.fovWidthDeg / fov,
      height: optics.fovHeightDeg / fov,
    },
  }
}
