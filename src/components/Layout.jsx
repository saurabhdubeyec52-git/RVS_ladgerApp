import { useEffect, useState, useCallback } from 'react'
import Sidebar from './Sidebar.jsx'
import { api } from '../api.js'

export default function Layout({ children }) {
  const [overdueCount, setOverdueCount] = useState(0)

  const refreshBadge = useCallback(async () => {
    try {
      const rows = await api.pending.overdue()
      setOverdueCount(rows.length)
    } catch {
      /* ignore badge errors */
    }
  }, [])

  useEffect(() => {
    refreshBadge()
    // Live update after any change anywhere in the app.
    return api.sync.onChange(refreshBadge)
  }, [refreshBadge])

  return (
    <div className="layout">
      <Sidebar overdueCount={overdueCount} />
      <main className="content">
        <div className="content-body">{children}</div>
      </main>
    </div>
  )
}
