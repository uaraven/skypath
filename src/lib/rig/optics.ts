/**
 * Rig optics: pure astrophotography-framing arithmetic, no ephemeris and no
 * Svelte. Lives next to `images/framing.ts`, which turns this into what the
 * Aladin view actually shows.
 */

import type { Rig } from './types'

/** Arcseconds per radian, i.e. 3600 × 180 / π — the constant behind the
 *  classic "206265 / focal length" image-scale formula. */
const ARCSEC_PER_RADIAN = 206264.806

export interface RigOptics {
  sensorWidthMm: number
  sensorHeightMm: number
  arcsecPerPixelX: number
  arcsecPerPixelY: number
  fovWidthDeg: number
  fovHeightDeg: number
  /** Null when the telescope has no aperture entered. */
  focalRatio: number | null
  /** Dawes' limit, null when the telescope has no aperture entered. See the
   *  file doc for why Dawes rather than Rayleigh. */
  diffractionArcsec: number | null
}

/**
 * Everything the rig editor and the framing assistant need from a rig's
 * telescope + camera: image scale, field of view, f-ratio and the Dawes
 * diffraction limit.
 */
export function rigOptics(rig: Rig): RigOptics {
  const { telescope, camera } = rig
  const sensorWidthMm = (camera.pixelsX * camera.pitchX) / 1000
  const sensorHeightMm = (camera.pixelsY * camera.pitchY) / 1000

  return {
    sensorWidthMm,
    sensorHeightMm,
    arcsecPerPixelX: imageScale(camera.pitchX, telescope.focalLength),
    arcsecPerPixelY: imageScale(camera.pitchY, telescope.focalLength),
    fovWidthDeg: fieldOfView(sensorWidthMm, telescope.focalLength),
    fovHeightDeg: fieldOfView(sensorHeightMm, telescope.focalLength),
    focalRatio: telescope.aperture
      ? telescope.focalLength / telescope.aperture
      : null,
    diffractionArcsec: telescope.aperture ? 116 / telescope.aperture : null,
  }
}

/** ″/pixel: `206265 × pitch_µm / focal_mm`. */
function imageScale(pitchUm: number, focalMm: number): number {
  return (ARCSEC_PER_RADIAN * (pitchUm / 1000)) / focalMm
}

/**
 * Field of view across one axis, in degrees, from the exact geometry
 * (`2·atan(sensor / (2·focal))`) rather than the small-angle approximation —
 * a full-frame sensor on a short lens is a 10°+ field, where the small-angle
 * form is visibly wrong, and the exact form costs nothing at narrow fields.
 */
function fieldOfView(sensorMm: number, focalMm: number): number {
  return 2 * Math.atan(sensorMm / (2 * focalMm)) * (180 / Math.PI)
}
