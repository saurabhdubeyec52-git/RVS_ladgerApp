import { getDb } from '../db/connection.js'
import { notify } from './notificationService.js'

/**
 * Lightweight status promotion only (no notifications / no broadcast). Safe to
 * call on every overdue read so figures stay current without a manual refresh.
 */
export function promoteOverdue() {
  getDb()
    .prepare(
      `UPDATE pending_payments
       SET status = 'overdue'
       WHERE status = 'pending' AND promised_date < date('now')`
    )
    .run()
}

/**
 * Promotes pending promises whose date has passed to 'overdue', fires one OS
 * notification per newly-overdue customer (deduped via notified_at), and asks
 * the renderer to refresh. Returns the count of newly-overdue promises.
 */
export function runOverdueCheck(getMainWindow) {
  const db = getDb()

  db.prepare(
    `UPDATE pending_payments
     SET status = 'overdue'
     WHERE status = 'pending' AND promised_date < date('now')`
  ).run()

  const fresh = db
    .prepare(
      `SELECT p.id, p.amount, p.promised_date, u.name, u.phone
       FROM pending_payments p
       JOIN users u ON u.id = p.user_id
       WHERE p.status = 'overdue' AND p.notified_at IS NULL AND u.archived_at IS NULL`
    )
    .all()

  const stamp = db.prepare(
    `UPDATE pending_payments SET notified_at = datetime('now') WHERE id = ?`
  )

  for (const row of fresh) {
    const amount = '₹' + Number(row.amount).toLocaleString('en-IN')
    notify(
      'Payment overdue',
      `${row.name} owes ${amount} (due ${row.promised_date})` +
        (row.phone ? ` — call ${row.phone}` : '')
    )
    stamp.run(row.id)
  }

  const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow
  if (fresh.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overdue:update')
  }

  return fresh.length
}

const HOUR = 60 * 60 * 1000
let timer = null

/** Runs the check now and every hour thereafter. */
export function startOverdueScheduler(getMainWindow) {
  runOverdueCheck(getMainWindow)
  timer = setInterval(() => runOverdueCheck(getMainWindow), HOUR)
}

export function stopOverdueScheduler() {
  if (timer) clearInterval(timer)
  timer = null
}
