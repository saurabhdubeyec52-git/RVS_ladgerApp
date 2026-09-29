import { ipcMain } from 'electron'
import * as authRepo from '../repositories/authRepo.js'
import * as userRepo from '../repositories/userRepo.js'
import * as transactionRepo from '../repositories/transactionRepo.js'
import * as pendingRepo from '../repositories/pendingRepo.js'
import * as statsRepo from '../repositories/statsRepo.js'
import * as licenseRepo from '../repositories/licenseRepo.js'
import { saveAttachment, readAttachment } from '../services/attachmentService.js'
import { runOverdueCheck, promoteOverdue } from '../services/overdueService.js'

// Read-only channels never mutate data, so they must NOT broadcast a change
// (that would loop: reload -> read -> broadcast -> reload ...).
const READ_ONLY = new Set([
  'auth:status',
  'auth:createAdmin',
  'auth:login',
  'license:status', // writes only the clock high-water mark; must not broadcast
  'users:list',
  'users:areas',
  'users:get',
  'users:archived',
  'tx:list',
  'tx:all',
  'tx:archived',
  'tx:image',
  'pending:open',
  'pending:history',
  'pending:overdue',
  'pending:list',
  'stats:dashboard'
])

export function registerIpc(getMainWindow) {
  // Tell every renderer window to re-pull its data after a mutation, so views
  // stay in sync without anyone clicking a refresh button.
  function broadcastChange() {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow
    if (win && !win.isDestroyed()) win.webContents.send('data:changed')
  }

  // Wrap a handler so thrown errors return a structured { ok:false } to the
  // renderer, and successful mutations broadcast a data:changed event.
  function handle(channel, fn) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        const data = await fn(...args)
        if (!READ_ONLY.has(channel)) broadcastChange()
        return { ok: true, data }
      } catch (err) {
        return { ok: false, error: err.message || String(err) }
      }
    })
  }

  // --- Licensing / app expiry ---
  // Authoritative expiry check lives in the main process so it can't be bypassed
  // by tampering with the renderer.
  handle('license:status', () => licenseRepo.getStatus())

  // --- Auth ---
  handle('auth:status', () => ({ hasAdmin: authRepo.hasAdmin() }))
  handle('auth:createAdmin', ({ username, password }) => authRepo.createAdmin(username, password))
  handle('auth:login', ({ username, password }) => {
    // Hard-block login when the license has expired (defense in depth — the
    // renderer also shows an expiry screen, but this is the real enforcement).
    if (licenseRepo.getStatus().expired) throw new Error('LICENSE_EXPIRED')
    const result = authRepo.login(username, password)
    if (!result) throw new Error('Invalid username or password')
    return result
  })

  // --- Customers ---
  handle('users:list', (search) => userRepo.listUsers(search))
  handle('users:areas', () => userRepo.listAreas())
  handle('users:get', (id) => userRepo.getUser(id))
  handle('users:create', (payload) => userRepo.createUser(payload))
  handle('users:update', ({ id, ...payload }) => userRepo.updateUser(id, payload))
  handle('users:archive', (id) => userRepo.archiveUser(id)) // soft-delete
  handle('users:archived', () => userRepo.listArchivedUsers())
  handle('users:restore', (id) => userRepo.restoreUser(id))
  handle('users:delete', (id) => userRepo.purgeUser(id)) // permanent (Archived page only)

  // --- Transactions ---
  handle('tx:list', (userId) => transactionRepo.listTransactions(userId))
  handle('tx:all', () => transactionRepo.listAllTransactions())
  handle('tx:add', (payload) => {
    // Persist an attached photo (data URL) to disk first, if provided.
    const imagePath = payload.image ? saveAttachment(payload.image) : null
    transactionRepo.addTransaction({ ...payload, imagePath })

    // Keep promise balances aligned with the customer ledger.
    if (payload.type === 'credit') {
      pendingRepo.applyPaymentToOpenPromise(payload.userId, payload.amount)
    } else if (payload.type === 'debit') {
      pendingRepo.addToOpenPromiseAmount(payload.userId, payload.amount)
    }

    return { ok: true }
  })
  handle('tx:update', ({ id, userId, ...payload }) => {
    transactionRepo.updateTransaction(id, payload)

    // Keep promise balances aligned with any ledger edit.
    if (payload.type === 'credit') {
      pendingRepo.applyPaymentToOpenPromise(userId, payload.amount)
    } else if (payload.type === 'debit') {
      pendingRepo.addToOpenPromiseAmount(userId, payload.amount)
    }

    return { ok: true }
  })
  handle('tx:delete', (id) => transactionRepo.archiveTransaction(id)) // soft-delete -> archive
  handle('tx:archived', (userId) => transactionRepo.listArchivedByUser(userId))
  handle('tx:image', (filename) => readAttachment(filename))
  handle('tx:restore', (id) => transactionRepo.restoreTransaction(id))
  handle('tx:purge', (id) => transactionRepo.purgeTransaction(id))

  // --- Pending payments / promises ---
  handle('pending:set', (payload) => pendingRepo.setPromise(payload))
  handle('pending:open', (userId) => pendingRepo.getOpenPromise(userId))
  handle('pending:history', (userId) => pendingRepo.getPromiseHistory(userId))
  handle('pending:markPaid', (id) => pendingRepo.markPaid(id))
  handle('pending:recordPayment', ({ id, amount }) => {
    const promise = pendingRepo.getPromiseById(id)
    if (!promise) throw new Error('Promise not found')
    // Record the actual payment as a ledger credit, then settle/reduce the promise.
    transactionRepo.addTransaction({
      userId: promise.user_id,
      type: 'credit',
      amount,
      description: 'Promised payment'
    })
    return pendingRepo.applyPayment(id, amount)
  })
  handle('pending:reschedule', ({ id, promisedDate }) =>
    pendingRepo.reschedulePromise(id, promisedDate)
  )
  handle('pending:overdue', () => {
    promoteOverdue() // keep statuses current on every read
    return pendingRepo.listOverdue()
  })
  handle('pending:list', () => {
    promoteOverdue() // keep statuses current so already-due promises drop off
    return pendingRepo.listPending()
  })

  // --- Dashboard stats ---
  handle('stats:dashboard', () => {
    promoteOverdue()
    return statsRepo.getDashboardStats()
  })

  // --- Manual overdue refresh ---
  handle('overdue:refresh', () => ({ newCount: runOverdueCheck(getMainWindow) }))
}
