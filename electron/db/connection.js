import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runSchema } from './schema.js'

let db = null

/**
 * Opens (and lazily creates) the SQLite database in Electron's per-user
 * data directory, applies pragmas, and ensures the schema exists.
 */
export function getDb() {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'payment-ledger.db')
  db = new Database(dbPath)

  // WAL gives better read/write concurrency and durability.
  db.pragma('journal_mode = WAL')
  // FULL fsyncs every commit so a committed ledger entry survives even a sudden
  // power loss / OS crash (no chance of losing the last entry). Slightly slower
  // writes than NORMAL — an acceptable trade for an accounting ledger.
  db.pragma('synchronous = FULL')
  // Keep temp tables / sort scratch in memory instead of spilling to disk.
  db.pragma('temp_store = MEMORY')
  // ~16 MB page cache (negative value = KiB) so hot tables/indexes stay resident.
  db.pragma('cache_size = -16000')
  // Enforce ON DELETE CASCADE and other foreign-key constraints.
  db.pragma('foreign_keys = ON')

  runSchema(db)
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
