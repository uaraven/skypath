import { describe, expect, it } from 'vitest'
import { rigOptics } from './optics'
import type { Rig } from './types'

const IMX571_ON_530MM: Rig = {
  id: 'a',
  name: 'Widefield newt',
  telescope: { focalLength: 530, aperture: 130 },
  camera: { pixelsX: 6252, pixelsY: 4176, pitchX: 3.76, pitchY: 3.76 },
}

describe('rigOptics', () => {
  it('matches the worked example: IMX571 on a 530mm scope', () => {
    const optics = rigOptics(IMX571_ON_530MM)

    expect(optics.arcsecPerPixelX).toBeCloseTo(1.463, 2)
    expect(optics.arcsecPerPixelY).toBeCloseTo(1.463, 2)
    expect(optics.fovWidthDeg).toBeCloseTo(2.541, 2)
    expect(optics.fovHeightDeg).toBeCloseTo(1.699, 2)
    expect(optics.sensorWidthMm).toBeCloseTo(23.507, 2)
    expect(optics.sensorHeightMm).toBeCloseTo(15.702, 2)
  })

  it('derives f-ratio and Dawes limit from the aperture', () => {
    const optics = rigOptics(IMX571_ON_530MM)

    expect(optics.focalRatio).toBeCloseTo(4.077, 2)
    expect(optics.diffractionArcsec).toBeCloseTo(0.892, 2)
  })

  it('reports f-ratio and diffraction as null without an aperture', () => {
    const rig: Rig = {
      ...IMX571_ON_530MM,
      telescope: { focalLength: 530 },
    }

    const optics = rigOptics(rig)

    expect(optics.focalRatio).toBeNull()
    expect(optics.diffractionArcsec).toBeNull()
  })

  it('uses the exact arctangent form, not the small-angle approximation', () => {
    // A full-frame-sized sensor on a very short lens is a wide field where
    // the small-angle approximation (sensor/focal, taken directly as
    // radians) overstates the field — atan grows sub-linearly — so this pins
    // the exact, smaller value instead.
    const rig: Rig = {
      id: 'b',
      name: 'Wide lens',
      telescope: { focalLength: 50 },
      camera: { pixelsX: 6000, pixelsY: 4000, pitchX: 6, pitchY: 6 },
    }

    const optics = rigOptics(rig)
    const smallAngleDeg = ((36 / 50) * 180) / Math.PI

    expect(optics.fovWidthDeg).toBeLessThan(smallAngleDeg)
    expect(optics.fovWidthDeg).toBeCloseTo(39.6, 1)
  })

  it('handles non-square pixels independently per axis', () => {
    const rig: Rig = {
      id: 'c',
      name: 'Rectangular pixels',
      telescope: { focalLength: 1000 },
      camera: { pixelsX: 1000, pixelsY: 1000, pitchX: 4, pitchY: 8 },
    }

    const optics = rigOptics(rig)

    expect(optics.arcsecPerPixelY).toBeCloseTo(optics.arcsecPerPixelX * 2, 3)
    expect(optics.fovHeightDeg).toBeCloseTo(optics.fovWidthDeg * 2, 1)
  })
})
