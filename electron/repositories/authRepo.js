import { getDb } from '../db/connection.js'
import { hashPassword, verifyPassword } from '../util/crypto.js'
import { getExpiry, setExpiry, effectiveNow } from './licenseRepo.js'

// Length of the automatic free trial granted on first-time setup.
const TRIAL_DAYS = 10

// Returns a local 'YYYY-MM-DD' string `days` days from the effective now.
function trialExpiryDate(days) {
  const { effective } = effectiveNow()
  const d = new Date(effective + days * 24 * 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** True once an admin account has been created. */
export function hasAdmin() {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM admin').get()
  return row.n > 0
}

/** Creates the single admin account. Throws if one already exists. */
export function createAdmin(username, password) {
  if (hasAdmin()) throw new Error('Admin already exists')
  if (!username || !password) throw new Error('Username and password are required')
  if (password.length < 4) throw new Error('Password must be at least 4 characters')

  const hash = hashPassword(password)
  getDb()
    .prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)')
    .run(username, hash)

  // First-time setup: start a 3-day free trial. Only set it when no expiry has
  // already been configured (e.g. by the super-admin), so we never shorten an
  // existing license.
  if (!getExpiry()) {
    setExpiry(trialExpiryDate(TRIAL_DAYS))
  }

  return { username }
}

/** Verifies credentials. Returns { username } on success or null on failure. */
export function login(username, password) {
  const row = getDb().prepare('SELECT * FROM admin WHERE id = 1').get()
  if (!row) return null
  if (row.username !== username) return null
  if (!verifyPassword(password, row.password_hash)) return null
  return { username: row.username }
}

/**
 * Read-only summary of the client admin account, for the super-admin panel.
 * Never returns the password hash.
 */
export function getInfo() {
  const row = getDb()
    .prepare('SELECT username, created_at FROM admin WHERE id = 1')
    .get()
  return {
    hasAdmin: !!row,
    username: row ? row.username : null,
    createdAt: row ? row.created_at : null
  }
}

/**
 * Resets the client admin password WITHOUT requiring the old one. Only called
 * by the authenticated super-admin panel (vendor authority), e.g. when the
 * client forgets their password.
 */
export function resetPassword(newPassword) {
  const row = getDb().prepare('SELECT id FROM admin WHERE id = 1').get()
  if (!row) throw new Error('Client account is not set up yet')
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters')
  }
  const hash = hashPassword(newPassword)
  getDb().prepare('UPDATE admin SET password_hash = ? WHERE id = 1').run(hash)
  return { ok: true }
}

/** Renames the client admin username. Super-admin panel only. */
export function setUsername(newUsername) {
  const row = getDb().prepare('SELECT id FROM admin WHERE id = 1').get()
  if (!row) throw new Error('Client account is not set up yet')
  if (!newUsername || !newUsername.trim()) {
    throw new Error('Username is required')
  }
  getDb().prepare('UPDATE admin SET username = ? WHERE id = 1').run(newUsername.trim())
  return { username: newUsername.trim() }
}
