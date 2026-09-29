import { getDb } from '../db/connection.js'
import { hashPassword, verifyPassword } from '../util/crypto.js'

// The vendor super-admin account that controls the embedded licensing panel.
// It is deliberately separate from the client `admin` account (see authRepo.js)
// so the client cannot change their own expiry date.

/** True once the super-admin account has been created. */
export function hasSuperAdmin() {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM super_admin').get()
  return row.n > 0
}

/**
 * Seeds the single super-admin row on first run if it doesn't exist yet.
 * Credentials come from env vars at runtime (so real secrets are never baked
 * into the asar); falls back to a documented default that should be changed
 * immediately via the panel.
 *
 *   SUPERADMIN_USER (default: 'superadmin')
 *   SUPERADMIN_PASS (default: 'changeme123')
 */
export function seedDefault() {
  if (hasSuperAdmin()) return

  const username = process.env.SUPERADMIN_USER || 'superadmin'
  const password = process.env.SUPERADMIN_PASS || 'changeme123'
  const hash = hashPassword(password)

  getDb()
    .prepare('INSERT INTO super_admin (id, username, password_hash) VALUES (1, ?, ?)')
    .run(username, hash)
}

/** Verifies super-admin credentials. Returns { username } or null. */
export function verify(username, password) {
  const row = getDb().prepare('SELECT * FROM super_admin WHERE id = 1').get()
  if (!row) return null
  if (row.username !== username) return null
  if (!verifyPassword(password, row.password_hash)) return null
  return { username: row.username }
}

/** Changes the super-admin password after verifying the old one. */
export function changePassword(oldPassword, newPassword) {
  const row = getDb().prepare('SELECT * FROM super_admin WHERE id = 1').get()
  if (!row) throw new Error('Super-admin not initialised')
  if (!verifyPassword(oldPassword, row.password_hash)) {
    throw new Error('Current password is incorrect')
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters')
  }
  const hash = hashPassword(newPassword)
  getDb()
    .prepare(
      `UPDATE super_admin SET password_hash = ?, updated_at = datetime('now') WHERE id = 1`
    )
    .run(hash)
  return { ok: true }
}

/** Current super-admin username (for display in the panel). */
export function getUsername() {
  const row = getDb().prepare('SELECT username FROM super_admin WHERE id = 1').get()
  return row ? row.username : null
}
