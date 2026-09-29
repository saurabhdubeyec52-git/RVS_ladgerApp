import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { api } from './api.js'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import ExpiredScreen from './pages/ExpiredScreen.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers.jsx'
import CustomerForm from './pages/CustomerForm.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import Transactions from './pages/Transactions.jsx'
import PendingPayments from './pages/PendingPayments.jsx'
import Settled from './pages/Settled.jsx'
import ArchivedUsers from './pages/ArchivedUsers.jsx'
import Notifications from './pages/Notifications.jsx'

export default function App() {
  const { isAuthed } = useAuth()
  // Licensing gate: null = checking, then { expired, expiry, ... }.
  const [license, setLicense] = useState(null)
  const [checking, setChecking] = useState(false)

  // Re-checks the license. Also called by the "Refresh" button on the expired
  // screen so a renewed license is picked up without restarting the app.
  const checkLicense = useCallback(async () => {
    setChecking(true)
    try {
      setLicense(await api.license.status())
    } catch {
      setLicense({ expired: false }) // fail open on read error
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    checkLicense()
    const id = setInterval(checkLicense, 60 * 60 * 1000) // re-check hourly (catches day rollover)
    return () => clearInterval(id)
  }, [checkLicense])

  // While the first license check is in flight, render nothing to avoid a flash
  // of the login screen before a possible expiry block.
  if (license === null) return <div className="auth-screen" />

  if (license.expired) {
    return (
      <ExpiredScreen
        expiry={license.expiry}
        onRefresh={checkLicense}
        refreshing={checking}
      />
    )
  }

  if (!isAuthed) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLicenseExpired={checkLicense} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/new" element={<CustomerForm />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/customers/:id/edit" element={<CustomerForm />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/pending" element={<PendingPayments />} />
        <Route path="/settled" element={<Settled />} />
        <Route path="/archived" element={<ArchivedUsers />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
