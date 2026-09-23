import { describe, expect, it } from 'vitest'
import { SENSORS, sensorById } from './sensors'

/**
 * The spec's own millimetre figures for each chip — the number a typo in a
 * table of twelve four-digit pixel counts would silently disagree with.
 * `pixelsX/Y × pitch ÷ 1000` should reproduce each within 2%.
 */
const EXPECTED_MM: Record<string, [width: number, height: number]> = {
  imx455: [36, 24],
  imx585: [11.2, 6.3],
  imx533: [11.3, 11.3],
  imx571: [23.5, 15.7],
  imx183: [13.2, 8.8],
  imx264: [8.5, 7.1],
  imx678: [7.68, 4.32],
  imx662: [5.57, 3.13],
  mn34230: [17.6, 13.3],
  'imx294-bin2': [19.1, 13.0],
  'imx294-bin1': [19.1, 13.0],
  os08b10: [11.2, 6.3],
}

describe('SENSORS', () => {
  it('has exactly the twelve chips from the spec', () => {
    expect(SENSORS).toHaveLength(12)
  })

  it('has a unique id for every sensor', () => {
    const ids = SENSORS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(SENSORS)(
    'derives $name’s quoted millimetre size within 2%',
    (sensor) => {
      const [expectedWidth, expectedHeight] = EXPECTED_MM[sensor.id]
      const widthMm = (sensor.pixelsX * sensor.pitch) / 1000
      const heightMm = (sensor.pixelsY * sensor.pitch) / 1000

      expect(Math.abs(widthMm - expectedWidth) / expectedWidth).toBeLessThan(
        0.02,
      )
      expect(Math.abs(heightMm - expectedHeight) / expectedHeight).toBeLessThan(
        0.02,
      )
    },
  )
})

describe('sensorById', () => {
  it('finds a sensor by id', () => {
    expect(sensorById('imx571')?.name).toBe('Sony IMX571')
  })

  it('returns undefined for an unknown id', () => {
    expect(sensorById('nope')).toBeUndefined()
  })
})
