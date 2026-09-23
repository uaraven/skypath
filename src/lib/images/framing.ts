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
  DEFAULT_FIELD_ARCMIN,
  MAX_FIELD_DEGREES,
  MIN_FIELD_DEGREES,
  type AladinOptions,
} from './aladin'

/**
 * How much wider the view is than whichever is larger, the rig's field or
 * the object. Distinct from `aladin.ts`'s `FRAMING_FACTOR` (1.5): that one
 * answers "how much sky around the object", this one answers "how much room
 * around the sensor's field", and the no-rig sky view keeps using the
 * former unchanged.
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

/** The object's own major axis, in degrees, with the same missing-size
 *  fallback `aladin.ts` uses. Unmultiplied — the margin is applied once,
 *  uniformly, over whichever of the rig or the object turns out larger. */
function objectFieldDegrees(object: DeepSkyObject): number {
  const arcmin =
    object.size && object.size > 0 ? object.size : DEFAULT_FIELD_ARCMIN
  return arcmin / 60
}

/**
 * Framing-assistant view parameters for an object, optionally through a rig.
 *
 * Without a rig, this degrades to exactly today's sky view: `aladin.ts`'s
 * object-sized field, no rectangle. With one, the view is sized to
 * `FRAME_MARGIN` times whichever is larger — the rig's *diagonal* (see
 * `rigDiagonalDeg`) or the object's own size — so a widefield rig on a small
 * target shows the rig's field around it, and a long focal length on a large
 * target shows the whole object with the sensor cropping a corner of it. The
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
  const larger = Math.max(
    rigDiagonalDeg(optics.fovWidthDeg, optics.fovHeightDeg),
    objectFieldDegrees(object),
  )
  const fov = Math.min(
    Math.max(FRAME_MARGIN * larger, MIN_FIELD_DEGREES),
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
