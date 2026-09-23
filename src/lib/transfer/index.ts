/**
 * Moving observatories and rigs together between machines as one JSON file.
 * Depends on both `lib/observatory` and `lib/rig`; neither of those may
 * depend back on this or on each other.
 */

export {
  serializeBackup,
  parseBackup,
  BACKUP_VERSION,
  type BackupFile,
  type BackupImport,
} from './backup'
