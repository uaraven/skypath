/**
 * Session: the selections that are not observatory data — the open object and
 * the chosen night — persisted to localStorage so a reload lands where the
 * user left off.
 */

export {
  SessionStore,
  session,
  SESSION_KEY,
  formatIsoDate,
  parseIsoDate,
  type Session,
} from './store'
