import { describe, expect, it } from 'vitest'
import type { TrajectoryPoint } from '../astro/types'
import { markerTriangle, shortestTurn, trajectoryAt } from './marker'

const START = new Date(2026, 9, 15, 12, 0, 0, 0)

/** A track with a sample every 5 minutes, like the real sampling step. */
function track(
  samples: readonly [altitude: number, azimuth: number][],
): TrajectoryPoint[] {
  return samples.map(([altitude, azimuth], i) => ({
    time: new Date(START.getTime() + i * 5 * 60_000),
    altitude,
    azimuth,
  }))
}

function at(minutes: number): Date {
  return new Date(START.getTime() + minutes * 60_000)
}

describe('trajectoryAt', () => {
  const points = track([
    [10, 90],
    [20, 100],
    [30, 110],
  ])

  it('returns a sample unchanged when the time lands on one', () => {
    expect(trajectoryAt(points, at(5))).toMatchObject({
      altitude: 20,
      azimuth: 100,
    })
  })

  it('interpolates between two samples', () => {
    const mid = trajectoryAt(points, at(2.5))!

    expect(mid.altitude).toBeCloseTo(15, 10)
    expect(mid.azimuth).toBeCloseTo(95, 10)
    expect(mid.time.getTime()).toBe(at(2.5).getTime())
  })

  it('holds the endpoints', () => {
    expect(trajectoryAt(points, at(0))).toMatchObject({ altitude: 10 })
    expect(trajectoryAt(points, at(10))).toMatchObject({ altitude: 30 })
  })

  // Clamping instead would park the indicator on the last drawn point and
  // claim the object is there at a time the track does not cover.
  it('returns null outside the track', () => {
    expect(trajectoryAt(points, at(-1))).toBeNull()
    expect(trajectoryAt(points, at(11))).toBeNull()
    expect(trajectoryAt([], at(0))).toBeNull()
  })

  it('takes the short way round when the object crosses north', () => {
    const crossing = track([
      [10, 359],
      [10, 1],
    ])

    expect(trajectoryAt(crossing, at(2.5))!.azimuth).toBeCloseTo(0, 10)
  })

  it('interpolates below the horizon too — the altitude chart draws it there', () => {
    const setting = track([
      [5, 270],
      [-5, 272],
    ])

    expect(trajectoryAt(setting, at(2.5))!.altitude).toBeCloseTo(0, 10)
  })

  it('finds the right segment in a long track', () => {
    const long = track(
      Array.from({ length: 289 }, (_, i) => [i, 0] as [number, number]),
    )

    expect(trajectoryAt(long, at(5 * 200))).toMatchObject({ altitude: 200 })
    expect(trajectoryAt(long, at(5 * 200 + 2.5))!.altitude).toBeCloseTo(
      200.5,
      10,
    )
  })
})

describe('shortestTurn', () => {
  it('is a plain difference away from the wrap', () => {
    expect(shortestTurn(90, 100)).toBe(10)
    expect(shortestTurn(100, 90)).toBe(-10)
  })

  it('goes the short way across north', () => {
    expect(shortestTurn(359, 1)).toBe(2)
    expect(shortestTurn(1, 359)).toBe(-2)
  })
})

describe('markerTriangle', () => {
  it('puts the apex on the point and hangs the body above it', () => {
    const d = markerTriangle({ x: 100, y: 50 }, 12)

    expect(d).toBe('M100 50 L94 38 L106 38 Z')
  })
})
