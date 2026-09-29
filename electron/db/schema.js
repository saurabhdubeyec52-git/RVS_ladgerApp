/**
 * Creates all tables if they do not yet exist. Safe to run on every startup.
 */
export function runSchema(db) {
  db.exec(`
    -- App admin (single-admin login)
    CREATE TABLE IF NOT EXISTS admin (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Vendor super-admin (single account, separate from the client admin).
    -- Used only by the embedded localhost licensing panel.
    CREATE TABLE IF NOT EXISTS super_admin (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Generic key/value app metadata. Keys in use:
    --   license_expiry : ISO date 'YYYY-MM-DD'; row absent = no expiry (unlimited)
    --   clock_hwm      : highest epoch-ms ever observed (clock-rollback detection)
    CREATE TABLE IF NOT EXISTS app_meta (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Customers ("Register User")
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT,
      email      TEXT,
      address    TEXT,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Credit/Debit ledger
    --   debit  = amount the customer owes (a charge/bill)
    --   credit = amount the customer paid
    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('credit','debit')),
      amount      REAL NOT NULL CHECK (amount > 0),
      description TEXT,
      txn_date    TEXT NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Promised completion dates for outstanding balances
    CREATE TABLE IF NOT EXISTS pending_payments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount        REAL NOT NULL,
      promised_date TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','overdue')),
      notified_at   TEXT,
      settled_at    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pending_user ON pending_payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_payments(status);

    -- Promise history: records changes to a pending payment (creation, reschedule,
    -- partial payments, settlement). Each row is immutable and used to show a
    -- customer's promise history in the UI.
    CREATE TABLE IF NOT EXISTS promise_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      pending_id   INTEGER REFERENCES pending_payments(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      old_amount   REAL,
      new_amount   REAL,
      old_date     TEXT,
      new_date     TEXT,
      action       TEXT,
      changed_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_promise_history_user ON promise_history(user_id);
  `)
  // The transactions index is created in migrate(), after archived_at has been
  // added to the table (that column doesn't exist in the base CREATE above).

  migrate(db)
}

/**
 * Incremental migrations for databases created before a column existed.
 * Adds archived_at to users and transactions for soft-delete (archiving).
 */
function migrate(db) {
  const hasColumn = (table, col) =>
    db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)

  if (!hasColumn('users', 'archived_at')) {
    db.exec('ALTER TABLE users ADD COLUMN archived_at TEXT')
  }
  if (!hasColumn('transactions', 'archived_at')) {
    db.exec('ALTER TABLE transactions ADD COLUMN archived_at TEXT')
  }
  if (!hasColumn('transactions', 'image_path')) {
    db.exec('ALTER TABLE transactions ADD COLUMN image_path TEXT')
  }
  if (!hasColumn('users', 'area')) {
    db.exec('ALTER TABLE users ADD COLUMN area TEXT')
  }

  // Backfill a sensible Area (the city — the text after the comma in the
  // address) for customers that don't have one yet. Idempotent: only fills
  // blank areas, so a value the user set is never overwritten.
  db.exec(`
    UPDATE users
    SET area = TRIM(SUBSTR(address, INSTR(address, ',') + 1))
    WHERE (area IS NULL OR TRIM(area) = '')
      AND address LIKE '%,%'
  `)

  // Covering index for the per-user balance aggregation (SUM of credit/debit,
  // archived rows excluded) used by listUsers and the dashboard stats. Having
  // user_id, archived_at, type AND amount in the index lets SQLite answer those
  // correlated subqueries from the index alone (no table lookups). Created here
  // because it references archived_at, which is added just above. It also makes
  // the older single-column idx_transactions_user(user_id) redundant — its
  // leftmost prefix is covered — so drop that to avoid double write overhead.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_balance
      ON transactions(user_id, archived_at, type, amount);
    DROP INDEX IF EXISTS idx_transactions_user;
  `)
}
