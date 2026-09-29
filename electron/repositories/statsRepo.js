import { getDb } from '../db/connection.js'

/** Aggregate counts for the dashboard cards (archived rows excluded). */
export function getDashboardStats() {
  const db = getDb()
  const one = (sql) => db.prepare(sql).get().n

  const customers = one('SELECT COUNT(*) AS n FROM users WHERE archived_at IS NULL')
  const transactions = one('SELECT COUNT(*) AS n FROM transactions WHERE archived_at IS NULL')
  const overdue = one(`
    SELECT COUNT(*) AS n FROM pending_payments p
    JOIN users u ON u.id = p.user_id
    WHERE p.status = 'overdue' AND u.archived_at IS NULL
  `)
  const pendingFuture = one(`
    SELECT COUNT(*) AS n FROM pending_payments p
    JOIN users u ON u.id = p.user_id
    WHERE p.status = 'pending' AND u.archived_at IS NULL
  `)

  // Customers whose paid amount covers (or exceeds) what they were charged.
  const settled = one(`
    SELECT COUNT(*) AS n FROM users u
    WHERE u.archived_at IS NULL
      AND COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'debit'  AND t.archived_at IS NULL), 0)
        - COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'credit' AND t.archived_at IS NULL), 0) <= 0
  `)

  // Total still owed across all active customers.
  const totalOutstanding = db
    .prepare(
      `SELECT COALESCE(SUM(bal), 0) AS total FROM (
         SELECT
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'debit'  AND t.archived_at IS NULL), 0)
         - COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'credit' AND t.archived_at IS NULL), 0) AS bal
         FROM users u WHERE u.archived_at IS NULL
       ) WHERE bal > 0`
    )
    .get().total

  return { customers, transactions, overdue, pendingFuture, settled, totalOutstanding }
}
