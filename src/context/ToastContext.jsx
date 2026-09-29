import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { setApiErrorHandler } from '../api.js'

const ToastContext = createContext(null)

let seq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type, message) => {
      const id = ++seq
      setToasts((ts) => [...ts, { id, type, message }])
      setTimeout(() => remove(id), 3500)
      return id
    },
    [remove]
  )

  const toast = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m)
    }),
    [push]
  )

  // Any failed IPC call (api.js throws) surfaces as an error toast automatically.
  useEffect(() => {
    setApiErrorHandler((message) => push('error', message))
    return () => setApiErrorHandler(null)
  }, [push])

  const icon = { success: '✓', error: '✕', info: 'ℹ' }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role="status"
            onClick={() => remove(t.id)}
          >
            <span className="toast-icon">{icon[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
