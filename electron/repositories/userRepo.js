import { getDb } from '../db/connection.js'

// Per-user balance aggregation (archived transactions are excluded).
const BALANCE_SELECT = `
  COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'credit' AND t.archived_at IS NULL), 0) AS total_credit,
  COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'debit'  AND t.archived_at IS NULL), 0) AS total_debit
`

function withOutstanding(row) {
  if (!row) return row
  const outstanding = (row.total_debit || 0) - (row.total_credit || 0)
  return { ...row, outstanding }
}

/** Active (non-archived) customers with computed balances. Optional search. */
export function listUsers(search = '') {
  const db = getDb()
  const like = `%${search}%`
  const rows = db
    .prepare(
      `SELECT u.*, ${BALANCE_SELECT}
       FROM users u
       WHERE u.archived_at IS NULL
         AND (? = '' OR u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)
       ORDER BY u.created_at DESC`
    )
    .all(search, like, like, like)
  return rows.map(withOutstanding)
}

export function getUser(id) {
  const row = getDb()
    .prepare(`SELECT u.*, ${BALANCE_SELECT} FROM users u WHERE u.id = ?`)
    .get(id)
  return withOutstanding(row)
}

/** Distinct, non-empty area names already in use (for the area picker). */
export function listAreas() {
  return getDb()
    .prepare(
      `SELECT DISTINCT TRIM(area) AS area
       FROM users
       WHERE area IS NOT NULL AND TRIM(area) <> ''
       ORDER BY area COLLATE NOCASE`
    )
    .all()
    .map((r) => r.area)
}

// Name, phone and area are mandatory for a customer.
function validateRequired({ name, phone, area }) {
  if (!name || !name.trim()) throw new Error('Name is required')
  if (!phone || !phone.trim()) throw new Error('Phone is required')
  if (!area || !area.trim()) throw new Error('Area is required')

  // Phone must be a 10-digit mobile number (ignoring an optional +91 prefix).
  const digits = String(phone).replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  if (!/^\d{10}$/.test(local)) throw new Error('Phone must be a valid 10-digit number')
}

export function createUser({ name, phone, email, address, area, notes }) {
  validateRequired({ name, phone, area })
  const info = getDb()
    .prepare(
      `INSERT INTO users (name, phone, email, address, area, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), phone.trim(), email || null, address || null, area.trim(), notes || null)
  return getUser(info.lastInsertRowid)
}

export function updateUser(id, { name, phone, email, address, area, notes }) {
  validateRequired({ name, phone, area })
  getDb()
    .prepare(
      `UPDATE users
       SET name = ?, phone = ?, email = ?, address = ?, area = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(name.trim(), phone.trim(), email || null, address || null, area.trim(), notes || null, id)
  return getUser(id)
}

/** Soft-delete: archive the customer (their ledger/promises stay linked). */
export function archiveUser(id) {
  getDb()
    .prepare(`UPDATE users SET archived_at = datetime('now') WHERE id = ?`)
    .run(id)
  return { id }
}

/** Archived customers (with balances, archived transactions excluded). */
export function listArchivedUsers() {
  const rows = getDb()
    .prepare(
      `SELECT u.*, ${BALANCE_SELECT}
       FROM users u
       WHERE u.archived_at IS NOT NULL
       ORDER BY u.archived_at DESC`
    )
    .all()
  return rows.map(withOutstanding)
}

export function restoreUser(id) {
  getDb().prepare(`UPDATE users SET archived_at = NULL WHERE id = ?`).run(id)
  return { id }
}

/** Permanently remove a customer; their transactions and promises cascade. */
export function purgeUser(id) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id)
  return { id }
}
