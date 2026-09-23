/**
 * Rigs: telescope + camera bundles the user manages for the framing
 * assistant, persisted to localStorage. `rigs` is the app-wide store; unlike
 * observatories the list may be empty and nothing may be selected.
 */

export {
  RigStore,
  rigs,
  selectedRig,
  STORAGE_KEY,
  type RigState,
} from './store'
export {
  isRig,
  type Rig,
  type RigInput,
  type Telescope,
  type Camera,
} from './types'
export { SENSORS, sensorById, type SensorPreset } from './sensors'
export { rigOptics, type RigOptics } from './optics'
