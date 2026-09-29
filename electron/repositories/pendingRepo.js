import { getDb } from '../db/connection.js'
import { parsePositiveAmount } from '../util/validation.js'

/**
 * Records (or replaces) the open promise for a customer. There is at most one
 * open (pending/overdue) promise per customer at a time, so any existing open
 * row is settled before inserting the new one.
 */
export function setPromise({ userId, amount, promisedDate }) {
  if (!promisedDate) throw new Error('A promised date is required')
  const value = parsePositiveAmount(amount, 'Pending amount must be greater than 0')

  const db = getDb()
  // Check the live ledger balance and replace the open promise atomically so a
  // stale renderer value cannot create a promise below the amount still owed.
  const tx = db.transaction(() => {
    const balance = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END), 0) AS outstanding
         FROM transactions
         WHERE user_id = ? AND archived_at IS NULL`
      )
      .get(userId).outstanding
    const outstandingCents = Math.round(Math.max(0, Number(balance)) * 100)
    const promiseCents = Math.round(value * 100)
    if (promiseCents < outstandingCents) {
      throw new Error(
        'Promise amount cannot be less than the current outstanding balance. Record a credit payment first to promise the reduced balance.'
      )
    }

    db.prepare(
      `UPDATE pending_payments
       SET status = 'paid', settled_at = datetime('now')
       WHERE user_id = ? AND status IN ('pending','overdue')`
    ).run(userId)
    const info = db
      .prepare(
        `INSERT INTO pending_payments (user_id, amount, promised_date, status)
         VALUES (?, ?, ?, 'pending')`
      )
      .run(userId, value, promisedDate)
    recordPromiseHistory({ pendingId: info.lastInsertRowid, userId, oldAmount: null, newAmount: value, oldDate: null, newDate: promisedDate, action: 'created' })
    return info.lastInsertRowid
  })
  tx()
  return { ok: true }
}

/** The current open promise for a customer, if any. */
export function getOpenPromise(userId) {
  return getDb()
    .prepare(
      `SELECT * FROM pending_payments
       WHERE user_id = ? AND status IN ('pending','overdue')
       ORDER BY id DESC LIMIT 1`
    )
    .get(userId)
}

/** Marks any open promise for a customer as settled (called when balance clears). */
export function settlePromises(userId) {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM pending_payments WHERE user_id = ? AND status IN (\'pending\',\'overdue\')')
    .all(userId)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const upd = db.prepare("UPDATE pending_payments SET status = 'paid', settled_at = datetime('now') WHERE id = ?")
  for (const r of rows) {
    upd.run(r.id)
    recordPromiseHistory({ pendingId: r.id, userId, oldAmount: r.amount, newAmount: 0, oldDate: r.promised_date, newDate: r.promised_date, action: 'settled' })
  }
  return { ok: true }
}

export function markPaid(id) {
  getDb()
    .prepare(
      `UPDATE pending_payments
       SET status = 'paid', settled_at = datetime('now')
       WHERE id = ?`
    )
    .run(id)
  return { id }
}

export function getPromiseById(id) {
  return getDb().prepare('SELECT * FROM pending_payments WHERE id = ?').get(id)
}

/** Record a promise history row. */
function recordPromiseHistory({ pendingId, userId, oldAmount, newAmount, oldDate, newDate, action }) {
  const db = getDb()
  db.prepare(
    `INSERT INTO promise_history (pending_id, user_id, old_amount, new_amount, old_date, new_date, action)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(pendingId || null, userId, oldAmount || null, newAmount || null, oldDate || null, newDate || null, action || null)
}

/**
 * If a customer has an open promise, apply a credit payment to that promise.
 * This keeps overdue/promised balances in sync when payments are entered from
 * the customer ledger instead of the notifications page.
 */
export function applyPaymentToOpenPromise(userId, amount) {
  const promise = getOpenPromise(userId)
  if (!promise) return null
  const res = applyPayment(promise.id, amount)
  // record history for the payment
  const db = getDb()
  const updated = db.prepare('SELECT * FROM pending_payments WHERE id = ?').get(promise.id)
  recordPromiseHistory({ pendingId: promise.id, userId, oldAmount: promise.amount, newAmount: updated ? updated.amount : 0, oldDate: promise.promised_date, newDate: updated ? updated.promised_date : promise.promised_date, action: res.settled ? 'paid' : 'partial_payment' })
  return res
}

/**
 * If a customer already has an open promise, a new debit increases the pending
 * amount so the promise view reflects the latest outstanding liability.
 */
export function addToOpenPromiseAmount(userId, amount) {
  const value = parsePositiveAmount(amount, 'Amount must be greater than 0')
  const promise = getOpenPromise(userId)
  const db = getDb()
  if (!promise) {
    // No open promise — create one with today's date so it's tracked.
    const info = db
      .prepare(
        `INSERT INTO pending_payments (user_id, amount, promised_date, status)
         VALUES (?, ?, date('now'), 'pending')`
      )
      .run(userId, value)
    const newId = info.lastInsertRowid
    recordPromiseHistory({ pendingId: newId, userId, oldAmount: null, newAmount: value, oldDate: null, newDate: new Date().toISOString().slice(0, 10), action: 'created_by_debit' })
    return { id: newId, amount: value }
  }

  const nextAmount = Number(promise.amount) + value
  db.prepare('UPDATE pending_payments SET amount = ? WHERE id = ?').run(nextAmount, promise.id)
  // record history for the increase
  recordPromiseHistory({ pendingId: promise.id, userId, oldAmount: promise.amount, newAmount: nextAmount, oldDate: promise.promised_date, newDate: promise.promised_date, action: 'debit_added' })
  return { id: promise.id, amount: nextAmount }
}

/**
 * Apply a payment against a promise. A full (or larger) payment settles it; a
 * smaller one reduces the remaining amount and leaves it open (still overdue),
 * so it stays in the notification list showing what's left.
 */
export function applyPayment(id, amount) {
  const value = parsePositiveAmount(amount, 'Payment amount must be greater than 0')

  const db = getDb()
  const promise = db.prepare('SELECT * FROM pending_payments WHERE id = ?').get(id)
  if (!promise) throw new Error('Promise not found')

  const remaining = Number(promise.amount) - value
  if (remaining > 0) {
    db.prepare('UPDATE pending_payments SET amount = ? WHERE id = ?').run(remaining, id)
    recordPromiseHistory({ pendingId: id, userId: promise.user_id, oldAmount: promise.amount, newAmount: remaining, oldDate: promise.promised_date, newDate: promise.promised_date, action: 'partial_payment' })
    return { id, remaining, settled: false }
  }

  db.prepare(
    `UPDATE pending_payments SET status = 'paid', settled_at = datetime('now') WHERE id = ?`
  ).run(id)
  recordPromiseHistory({ pendingId: id, userId: promise.user_id, oldAmount: promise.amount, newAmount: 0, oldDate: promise.promised_date, newDate: promise.promised_date, action: 'paid' })
  return { id, remaining: 0, settled: true }
}

/** Move the promised date; reopen as pending so it drops off the overdue list
 * until the new date passes (then the scheduler re-promotes & re-notifies). */
export function reschedulePromise(id, promisedDate) {
  if (!promisedDate) throw new Error('A promised date is required')
  const db = getDb()
  const promise = db.prepare('SELECT * FROM pending_payments WHERE id = ?').get(id)
  if (!promise) throw new Error('Promise not found')
  db
    .prepare(
      `UPDATE pending_payments
       SET promised_date = ?, status = 'pending', notified_at = NULL, settled_at = NULL
       WHERE id = ?`
    )
    .run(promisedDate, id)
  recordPromiseHistory({ pendingId: id, userId: promise.user_id, oldAmount: promise.amount, newAmount: promise.amount, oldDate: promise.promised_date, newDate: promisedDate, action: 'rescheduled' })
  return { id }
}

export function getPromiseHistory(userId) {
  return getDb()
    .prepare(
      `SELECT id, pending_id, old_amount AS oldAmount, new_amount AS newAmount,
              old_date AS oldDate, new_date AS newDate, action, changed_at AS changedAt
       FROM promise_history
       WHERE user_id = ?
       ORDER BY changed_at ASC`
    )
    .all(userId)
}

/** Delete one history entry without changing the customer's current promise. */
export function deletePromiseHistory(id) {
  const historyId = Number(id)
  if (!Number.isSafeInteger(historyId) || historyId <= 0) {
    throw new Error('Invalid promise history entry')
  }

  const result = getDb().prepare('DELETE FROM promise_history WHERE id = ?').run(historyId)
  if (result.changes === 0) throw new Error('Promise history entry not found')
  return { id: historyId }
}

/** All future (pending, not yet due) promises joined with full customer details. */
export function listPending() {
  return getDb()
    .prepare(
      `SELECT p.id AS pending_id, p.amount, p.promised_date, p.status, p.notified_at,
              u.id AS user_id, u.name, u.phone, u.email, u.area, u.address, u.notes,
              CAST(julianday('now') - julianday(p.promised_date) AS INTEGER) AS days_overdue
       FROM pending_payments p
       JOIN users u ON u.id = p.user_id
       WHERE p.status = 'pending' AND u.archived_at IS NULL
       ORDER BY p.promised_date ASC`
    )
    .all()
}

/** All overdue promises joined with full customer details (newest-due first). */
export function listOverdue() {
  return getDb()
    .prepare(
      `SELECT p.id AS pending_id, p.amount, p.promised_date, p.status, p.notified_at,
              u.id AS user_id, u.name, u.phone, u.email, u.area, u.address, u.notes,
              CAST(julianday('now') - julianday(p.promised_date) AS INTEGER) AS days_overdue
       FROM pending_payments p
       JOIN users u ON u.id = p.user_id
       WHERE p.status = 'overdue' AND u.archived_at IS NULL
       ORDER BY p.promised_date ASC`
    )
    .all()
}
