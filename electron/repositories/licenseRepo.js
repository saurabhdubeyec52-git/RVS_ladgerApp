import { getDb } from '../db/connection.js'

// --- app_meta key/value helpers ---

export function getMeta(key) {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key)
  return row ? row.value : null
}

export function setMeta(key, value) {
  getDb()
    .prepare(
      `INSERT INTO app_meta (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(key, value == null ? null : String(value))
}

// --- Clock-rollback detection ---
//
// We keep a monotonic "high-water mark" of the largest epoch-ms we've ever seen.
// effectiveNow() returns max(systemNow, hwm) and persists the new max, so moving
// the system clock backwards cannot make a license look valid again. It also
// reports whether the system clock currently reads earlier than the hwm, which
// we treat as tampering.
//
// Caveat: the hwm lives in the user-controlled SQLite file, so deleting the DB
// resets it. This raises the bar but is not unbypassable (see plan caveats).
function readHwm() {
  const raw = getMeta('clock_hwm')
  const n = raw == null ? 0 : Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function effectiveNow() {
  const sys = Date.now()
  const hwm = readHwm()
  const eff = Math.max(sys, hwm)
  if (eff > hwm) setMeta('clock_hwm', eff)
  return { effective: eff, system: sys, hwm, rolledBack: sys < hwm }
}

// --- License expiry ---

/** ISO 'YYYY-MM-DD' or null (unlimited). */
export function getExpiry() {
  return getMeta('license_expiry')
}

/** Sets the expiry date. Pass a 'YYYY-MM-DD' string. */
export function setExpiry(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error('Expiry must be a date in YYYY-MM-DD format')
  }
  setMeta('license_expiry', isoDate)
  return { expiry: isoDate }
}

/** Removes the expiry entirely → app becomes unlimited. */
export function clearExpiry() {
  getDb().prepare('DELETE FROM app_meta WHERE key = ?').run('license_expiry')
  return { expiry: null }
}

/**
 * Computes the current licensing status.
 * Expiry is treated as INCLUSIVE end-of-day (the app works through the whole
 * expiry date and blocks the day after). A detected clock rollback while a
 * license is set is treated as expired (conservative).
 */
export function getStatus() {
  const expiry = getExpiry()
  const { effective, rolledBack } = effectiveNow()

  if (!expiry) {
    return {
      expiry: null,
      unlimited: true,
      expired: false,
      daysRemaining: null,
      clockRolledBack: rolledBack
    }
  }

  // End of the expiry day (local midnight of the following day).
  const end = new Date(`${expiry}T23:59:59.999`).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const daysRemaining = Math.ceil((end - effective) / dayMs)
  const expired = effective > end || rolledBack

  return {
    expiry,
    unlimited: false,
    expired,
    daysRemaining,
    clockRolledBack: rolledBack
  }
}
