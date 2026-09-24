/**
 * The built-in camera sensors from the spec, quoted as resolution + pixel
 * pitch — the canonical form `types.ts` stores (see its file doc). Physical
 * sensor size is derived, not stored, and reproduces the spec's millimetre
 * figures to within about 1% (see `sensors.test.ts`).
 *
 * A frozen array, not a store: this list ships with the app and the user
 * never edits it, only picks from it or ignores it entirely ("Custom" is the
 * absence of a `sensorId` on a `Camera`, not an entry here).
 */

export interface SensorPreset {
  id: string
  name: string
  pixelsX: number
  pixelsY: number
  /** µm; square pixels, so one value covers both axes. */
  pitch: number
}

export const SENSORS: readonly SensorPreset[] = [
  {
    id: 'imx455',
    name: 'Sony IMX455',
    pixelsX: 9576,
    pixelsY: 6388,
    pitch: 3.76,
  },
  {
    id: 'imx585',
    name: 'Sony IMX585',
    pixelsX: 3840,
    pixelsY: 2160,
    pitch: 2.9,
  },
  {
    id: 'imx533',
    name: 'Sony IMX533',
    pixelsX: 3008,
    pixelsY: 3008,
    pitch: 3.76,
  },
  {
    id: 'imx571',
    name: 'Sony IMX571',
    pixelsX: 6252,
    pixelsY: 4176,
    pitch: 3.76,
  },
  {
    id: 'imx183',
    name: 'Sony IMX183',
    pixelsX: 5544,
    pixelsY: 3694,
    pitch: 2.4,
  },
  {
    id: 'imx264',
    name: 'Sony IMX264',
    pixelsX: 2464,
    pixelsY: 2056,
    pitch: 3.45,
  },
  {
    id: 'imx678',
    name: 'Sony IMX678',
    pixelsX: 3840,
    pixelsY: 2160,
    pitch: 2,
  },
  {
    id: 'imx662',
    name: 'Sony IMX662',
    pixelsX: 1920,
    pixelsY: 1080,
    pitch: 2.9,
  },
  {
    id: 'mn34230',
    name: 'Panasonic MN34230',
    pixelsX: 4646,
    pixelsY: 3520,
    pitch: 3.8,
  },
  {
    id: 'imx294-bin2',
    name: 'Sony IMX294 (bin2)',
    pixelsX: 4144,
    pixelsY: 2822,
    pitch: 4.63,
  },
  {
    id: 'imx294-bin1',
    name: 'Sony IMX294 (bin1)',
    pixelsX: 8288,
    pixelsY: 5644,
    pitch: 2.3,
  },
  {
    id: 'os08b10',
    name: 'OmniVision OS08B10',
    pixelsX: 3840,
    pixelsY: 2160,
    pitch: 2.9,
  },
] as const

export function sensorById(id: string): SensorPreset | undefined {
  return SENSORS.find((s) => s.id === id)
}
