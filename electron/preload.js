import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload)

contextBridge.exposeInMainWorld('api', {
  auth: {
    status: () => invoke('auth:status'),
    createAdmin: (username, password) => invoke('auth:createAdmin', { username, password }),
    login: (username, password) => invoke('auth:login', { username, password })
  },
  license: {
    status: () => invoke('license:status')
  },
  users: {
    list: (search = '') => invoke('users:list', search),
    areas: () => invoke('users:areas'),
    get: (id) => invoke('users:get', id),
    create: (payload) => invoke('users:create', payload),
    update: (id, payload) => invoke('users:update', { id, ...payload }),
    archive: (id) => invoke('users:archive', id),
    archived: () => invoke('users:archived'),
    restore: (id) => invoke('users:restore', id),
    remove: (id) => invoke('users:delete', id)
  },
  tx: {
    list: (userId) => invoke('tx:list', userId),
    all: () => invoke('tx:all'),
    add: (payload) => invoke('tx:add', payload),
    update: (payload) => invoke('tx:update', payload),
    remove: (id) => invoke('tx:delete', id),
    archived: (userId) => invoke('tx:archived', userId),
    restore: (id) => invoke('tx:restore', id),
    purge: (id) => invoke('tx:purge', id),
    image: (filename) => invoke('tx:image', filename)
  },
  pending: {
    set: (payload) => invoke('pending:set', payload),
    open: (userId) => invoke('pending:open', userId),
    history: (userId) => invoke('pending:history', userId),
    markPaid: (id) => invoke('pending:markPaid', id),
    recordPayment: (payload) => invoke('pending:recordPayment', payload),
    reschedule: (payload) => invoke('pending:reschedule', payload),
    overdue: () => invoke('pending:overdue'),
    list: () => invoke('pending:list')
  },
  stats: {
    dashboard: () => invoke('stats:dashboard')
  },
  overdue: {
    refresh: () => invoke('overdue:refresh'),
    // Subscribe to push updates from the main process. Returns an unsubscribe fn.
    onUpdate: (cb) => {
      const listener = () => cb()
      ipcRenderer.on('overdue:update', listener)
      return () => ipcRenderer.removeListener('overdue:update', listener)
    }
  },
  // Fires after any data mutation (or overdue change) anywhere in the app, so
  // views can auto-refresh. Returns an unsubscribe fn.
  sync: {
    onChange: (cb) => {
      const listener = () => cb()
      ipcRenderer.on('data:changed', listener)
      ipcRenderer.on('overdue:update', listener)
      return () => {
        ipcRenderer.removeListener('data:changed', listener)
        ipcRenderer.removeListener('overdue:update', listener)
      }
    }
  }
})
