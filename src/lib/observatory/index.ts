/**
 * Observatories: named site + horizon bundles the user manages, persisted to
 * localStorage. `observatories` is the app-wide store; everything that needs a
 * location or a horizon reads it from the selected observatory.
 */

export {
  ObservatoryStore,
  observatories,
  selectedObservatory,
  STORAGE_KEY,
  DEFAULT_OBSERVATORY,
  type ObservatoryState,
} from './store'
export {
  observatoryLocation,
  isObservatory,
  LATITUDE_RANGE,
  LONGITUDE_RANGE,
  type Observatory,
  type ObservatoryInput,
} from './types'
export {
  serializeObservatories,
  parseObservatoryImport,
  EXPORT_VERSION,
  type ObservatoryExport,
  type ImportResult,
} from './transfer'
