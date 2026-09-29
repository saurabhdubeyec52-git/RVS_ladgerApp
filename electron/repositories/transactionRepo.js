import { getDb } from '../db/connection.js'
import { parsePositiveAmount } from '../util/validation.js'

export function listTransactions(userId) {
  return getDb()
    .prepare(
      `SELECT * FROM transactions
       WHERE user_id = ? AND archived_at IS NULL
       ORDER BY txn_date DESC, id DESC`
    )
    .all(userId)
}

export function addTransaction({ userId, type, amount, description, txnDate, imagePath }) {
  if (type !== 'credit' && type !== 'debit') throw new Error('Invalid transaction type')
  const value = parsePositiveAmount(amount, 'Amount must be greater than 0')

  getDb()
    .prepare(
      `INSERT INTO transactions (user_id, type, amount, description, txn_date, image_path)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`
    )
    .run(userId, type, value, description || null, txnDate || null, imagePath || null)
  return { ok: true }
}

/** Edit an existing ledger entry's type, amount, description and date. */
export function updateTransaction(id, { type, amount, description, txnDate }) {
  if (type !== 'credit' && type !== 'debit') throw new Error('Invalid transaction type')
  const value = parsePositiveAmount(amount, 'Amount must be greater than 0')

  getDb()
    .prepare(
      `UPDATE transactions
       SET type = ?, amount = ?, description = ?, txn_date = COALESCE(?, txn_date)
       WHERE id = ?`
    )
    .run(type, value, description || null, txnDate || null, id)
  return { id }
}

/** Soft-delete: move the entry to the archive instead of removing it. */
export function archiveTransaction(id) {
  getDb()
    .prepare(`UPDATE transactions SET archived_at = datetime('now') WHERE id = ?`)
    .run(id)
  return { id }
}

/** Archived ledger entries for a single customer. */
export function listArchivedByUser(userId) {
  return getDb()
    .prepare(
      `SELECT * FROM transactions
       WHERE user_id = ? AND archived_at IS NOT NULL
       ORDER BY archived_at DESC`
    )
    .all(userId)
}

/** All active (non-archived) ledger entries joined with their customer's name. */
export function listAllTransactions() {
  return getDb()
    .prepare(
      `SELECT t.*, u.id AS user_id, u.name AS user_name
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.archived_at IS NULL AND u.archived_at IS NULL
       ORDER BY t.txn_date DESC, t.id DESC`
    )
    .all()
}

export function restoreTransaction(id) {
  getDb().prepare(`UPDATE transactions SET archived_at = NULL WHERE id = ?`).run(id)
  return { id }
}

/** Permanently remove an archived entry. */
export function purgeTransaction(id) {
  getDb().prepare(`DELETE FROM transactions WHERE id = ?`).run(id)
  return { id }
}
