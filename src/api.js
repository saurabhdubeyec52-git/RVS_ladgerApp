// Thin wrapper over the preload-exposed window.api that unwraps the
// { ok, data, error } envelope and throws on failure.
const raw = window.api

// Optional global handler (wired by the toast provider) so any failed IPC call
// surfaces a notification without each caller having to handle it.
let apiErrorHandler = null
export function setApiErrorHandler(fn) {
  apiErrorHandler = fn
}

async function unwrap(promise) {
  const res = await promise
  if (!res || res.ok === false) {
    const message = (res && res.error) || 'Request failed'
    // LICENSE_EXPIRED is handled by the caller (App switches to the Expired
    // screen), so don't surface the raw code as a toast.
    if (apiErrorHandler && message !== 'LICENSE_EXPIRED') apiErrorHandler(message)
    throw new Error(message)
  }
  return res.data
}

export const api = {
  auth: {
    status: () => unwrap(raw.auth.status()),
    createAdmin: (u, p) => unwrap(raw.auth.createAdmin(u, p)),
    login: (u, p) => unwrap(raw.auth.login(u, p))
  },
  license: {
    status: () => unwrap(raw.license.status())
  },
  users: {
    list: (search) => unwrap(raw.users.list(search)),
    areas: () => unwrap(raw.users.areas()),
    get: (id) => unwrap(raw.users.get(id)),
    create: (payload) => unwrap(raw.users.create(payload)),
    update: (id, payload) => unwrap(raw.users.update(id, payload)),
    archive: (id) => unwrap(raw.users.archive(id)),
    archived: () => unwrap(raw.users.archived()),
    restore: (id) => unwrap(raw.users.restore(id)),
    remove: (id) => unwrap(raw.users.remove(id))
  },
  tx: {
    list: (userId) => unwrap(raw.tx.list(userId)),
    all: () => unwrap(raw.tx.all()),
    add: (payload) => unwrap(raw.tx.add(payload)),
    update: (payload) => unwrap(raw.tx.update(payload)),
    remove: (id) => unwrap(raw.tx.remove(id)),
    archived: (userId) => unwrap(raw.tx.archived(userId)),
    restore: (id) => unwrap(raw.tx.restore(id)),
    purge: (id) => unwrap(raw.tx.purge(id)),
    image: (filename) => unwrap(raw.tx.image(filename))
  },
  pending: {
    set: (payload) => unwrap(raw.pending.set(payload)),
    open: (userId) => unwrap(raw.pending.open(userId)),
    history: (userId) => unwrap(raw.pending.history(userId)),
    removeHistory: (id) => unwrap(raw.pending.removeHistory(id)),
    markPaid: (id) => unwrap(raw.pending.markPaid(id)),
    recordPayment: (payload) => unwrap(raw.pending.recordPayment(payload)),
    reschedule: (payload) => unwrap(raw.pending.reschedule(payload)),
    overdue: () => unwrap(raw.pending.overdue()),
    list: () => unwrap(raw.pending.list())
  },
  stats: {
    dashboard: () => unwrap(raw.stats.dashboard())
  },
  overdue: {
    refresh: () => unwrap(raw.overdue.refresh()),
    onUpdate: (cb) => raw.overdue.onUpdate(cb)
  },
  sync: {
    // Subscribe to "something changed anywhere" and auto-reload. Returns unsub.
    onChange: (cb) => raw.sync.onChange(cb)
  }
}

export function formatMoney(n) {
  const value = Number(n) || 0
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Formats a stored timestamp ("YYYY-MM-DD HH:MM:SS") as just the date part.
export const formatDate = (s) => s?.slice(0, 10)
