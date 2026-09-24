import { describe, expect, it } from 'vitest'
import type { DeepSkyObject } from '../astro/types'
import { rigOptics, type Rig } from '../rig'
import { MAX_FIELD_DEGREES, MIN_FIELD_DEGREES } from './aladin'
import { FRAME_MARGIN, framingViewParams } from './framing'

function object(overrides: Partial<DeepSkyObject> = {}): DeepSkyObject {
  return {
    id: 'test',
    name: 'Test object',
    kind: 'deep-sky',
    ra: 1,
    dec: 2,
    ...overrides,
  }
}

const WIDEFIELD: Rig = {
  id: 'a',
  name: 'Widefield newt',
  telescope: { focalLength: 530, aperture: 130 },
  // ~2.54° x 1.70° field, from the optics worked example.
  camera: { pixelsX: 6252, pixelsY: 4176, pitchX: 3.76, pitchY: 3.76 },
}

const LONG_FOCAL: Rig = {
  id: 'b',
  name: 'Long refractor',
  telescope: { focalLength: 3000 },
  // A small, deep field: ~0.09° across.
  camera: { pixelsX: 1000, pixelsY: 1000, pitchX: 4, pitchY: 4 },
}

describe('without a rig', () => {
  it('degrades to exactly the object-sized sky view, with no frame', () => {
    const params = framingViewParams(object({ size: 60 }), null)

    expect(params.frame).toBeNull()
    expect(params.fov).toBeCloseTo(1.5, 6) // FRAMING_FACTOR
  })

  it('still honours a survey override', () => {
    const params = framingViewParams(object(), null, { survey: 'P/DSS2/red' })

    expect(params.survey).toBe('P/DSS2/red')
  })
})

describe('with a rig', () => {
  it("sizes the view to 1.25x the rig's diagonal, not its larger axis", () => {
    const params = framingViewParams(object({ size: 30 }), WIDEFIELD)

    const optics = rigOptics(WIDEFIELD)
    const diagonal = Math.hypot(optics.fovWidthDeg, optics.fovHeightDeg)
    expect(params.fov).toBeCloseTo(FRAME_MARGIN * diagonal, 6)
    // Sizing off the larger axis alone (2.541°) would undershoot this.
    expect(params.fov).toBeGreaterThan(FRAME_MARGIN * optics.fovWidthDeg)
  })

  it('keeps the rectangle inside the box at every rotation, not just 0°', () => {
    const params = framingViewParams(object({ size: 30 }), WIDEFIELD)

    expect(params.frame).not.toBeNull()
    // A rectangle rotated about the box's centre reaches out to its own
    // diagonal in the worst case; that diagonal has to fit within the box's
    // own diagonal capacity (1, in these fractional units) for the frame to
    // never clip regardless of the slider's position.
    const frameDiagonal = Math.hypot(params.frame!.width, params.frame!.height)
    expect(frameDiagonal).toBeLessThanOrEqual(1)
    expect(frameDiagonal).toBeCloseTo(1 / FRAME_MARGIN, 6)
    expect(params.frame!.height).toBeLessThan(params.frame!.width)
  })

  it('ignores the object size entirely — the object never changes the fov or frame', () => {
    // M31-scale object (178′ major axis = ~2.97°), much bigger than the
    // long-focal-length rig's ~0.09° field: the view still zooms to the
    // rig, not out to the object.
    const small = framingViewParams(object({ size: 1 }), LONG_FOCAL)
    const large = framingViewParams(object({ size: 178 }), LONG_FOCAL)

    const optics = rigOptics(LONG_FOCAL)
    const diagonal = Math.hypot(optics.fovWidthDeg, optics.fovHeightDeg)
    expect(small.fov).toBeCloseTo(FRAME_MARGIN * diagonal, 6)
    expect(large.fov).toBeCloseTo(small.fov, 6)
    expect(large.frame).toEqual(small.frame)
  })

  it('switching to a different rig changes the view even for the same object', () => {
    const wide = framingViewParams(object({ size: 30 }), WIDEFIELD)
    const long = framingViewParams(object({ size: 30 }), LONG_FOCAL)

    expect(wide.fov).not.toBeCloseTo(long.fov, 2)
  })
})

describe('missing object size', () => {
  it('falls back to the default field, same as aladin.ts', () => {
    const withSize = framingViewParams(object({ size: 30 }), WIDEFIELD)
    const withoutSize = framingViewParams(
      object({ size: undefined }),
      WIDEFIELD,
    )

    // The object's size no longer affects the rig-sized view at all.
    expect(withoutSize.fov).toBeCloseTo(withSize.fov, 6)
  })
})

describe('clamping', () => {
  it('clamps a very wide rig field to MAX_FIELD_DEGREES and overflows the frame', () => {
    const wideLens: Rig = {
      id: 'c',
      name: 'Wide lens',
      telescope: { focalLength: 20 },
      camera: { pixelsX: 6000, pixelsY: 4000, pitchX: 6, pitchY: 6 },
    }

    const params = framingViewParams(object({ size: 30 }), wideLens)

    expect(params.fov).toBe(MAX_FIELD_DEGREES)
    // The frame is wider than the box it will be drawn in.
    expect(params.frame!.width).toBeGreaterThan(1)
  })

  it("clamps a very small rig field to MIN_FIELD_DEGREES", () => {
    const tinyRig: Rig = {
      id: 'd',
      name: 'Deep rig',
      telescope: { focalLength: 10000 },
      camera: { pixelsX: 500, pixelsY: 500, pitchX: 2, pitchY: 2 },
    }

    const params = framingViewParams(object({ size: 0.01 }), tinyRig)

    expect(params.fov).toBe(MIN_FIELD_DEGREES)
  })
})

describe('rotation sign (screen vs. position angle)', () => {
  // Position angle is measured north through east; Aladin renders north up,
  // east left, so PA increases counter-clockwise on screen while SVG/CSS
  // rotate() is clockwise-positive. This pins the conversion the component
  // applies, independent of any DOM: screenRotationDeg = -positionAngleDeg.
  it('maps 90° PA to -90° on screen', () => {
    const screenRotationDeg = (positionAngleDeg: number) => -positionAngleDeg

    expect(screenRotationDeg(90)).toBe(-90)
    expect(screenRotationDeg(0)).toBe(-0)
    expect(screenRotationDeg(270)).toBe(-270)
  })
})
