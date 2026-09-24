/**
 * A rig: the telescope + camera combination the framing assistant estimates a
 * field of view for.
 *
 * The camera is stored in exactly one form — resolution + pixel pitch — even
 * though the spec lets the user enter either that or resolution + physical
 * sensor size. Those are the same fact twice (`mm = px × µm ÷ 1000`), and
 * pitch is what the sensor table in the spec is quoted in and what survives
 * rounding best (see `sensors.ts`). The editor derives sensor size for
 * display and keeps both fields live-linked; only pitch is persisted.
 */
export interface Telescope {
  /** mm. */
  focalLength: number
  /** mm; optional — the spec calls it "not technically needed", and only the
   *  f-ratio and diffraction limit use it. */
  aperture?: number
}

export interface Camera {
  /** Set when picked from the built-in list, so the editor can show which
   *  chip is selected on reopen. Absent means a fully custom camera. */
  sensorId?: string
  pixelsX: number
  pixelsY: number
  /** µm. Square pixels are the norm, but both axes are stored. */
  pitchX: number
  pitchY: number
}

export interface Rig {
  id: string
  name: string
  telescope: Telescope
  camera: Camera
}

/** The fields the user fills in; the store assigns the id. */
export type RigInput = Omit<Rig, 'id'>

/**
 * Structural check used when reading localStorage, where the data may be from
 * an older build, a different app, or a user poking at devtools.
 */
export function isRig(value: unknown): value is Rig {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Rig>
  return (
    typeof candidate.id === 'string' &&
    candidate.id !== '' &&
    typeof candidate.name === 'string' &&
    isTelescope(candidate.telescope) &&
    isCamera(candidate.camera)
  )
}

function isTelescope(value: unknown): value is Telescope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Telescope>
  return (
    isPositive(candidate.focalLength) &&
    (candidate.aperture === undefined || isPositive(candidate.aperture))
  )
}

function isCamera(value: unknown): value is Camera {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Camera>
  return (
    (candidate.sensorId === undefined ||
      typeof candidate.sensorId === 'string') &&
    isPositiveInt(candidate.pixelsX) &&
    isPositiveInt(candidate.pixelsY) &&
    isPositive(candidate.pitchX) &&
    isPositive(candidate.pitchY)
  )
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isPositiveInt(value: unknown): value is number {
  return isPositive(value) && Number.isInteger(value)
}
