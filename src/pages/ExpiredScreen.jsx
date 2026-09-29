import { useState } from 'react'
import logo from '../assets/logo.png'

// Hard-block screen shown (instead of Login) when the app license has expired.
// The authoritative check is in the main process (auth:login throws), this is
// the matching user-facing gate. The Refresh button re-checks the license so a
// renewed license is picked up immediately, without restarting the app.
export default function ExpiredScreen({ expiry, onRefresh, refreshing }) {
  const [stillExpired, setStillExpired] = useState(false)

  async function handleRefresh() {
    setStillExpired(false)
    await onRefresh?.()
    // If we're still showing this screen after the check, it's still expired.
    setStillExpired(true)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card expired-card">
        <h1 className="auth-brand" style={{ justifyContent: 'center' }}>
          <img className="brand-logo" src={logo} alt="" />
          RVS Ledger
        </h1>

        <div className="expired-badge" aria-hidden="true">
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="11" width="17" height="10" rx="2.2" />
            <path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" />
            <circle cx="12" cy="15.8" r="1.5" fill="#fff" stroke="none" />
          </svg>
        </div>

        <h2 className="expired-title">License Expired</h2>

        {expiry && <div className="expired-pill">Access expired on {expiry}</div>}

        <p className="expired-note">
          All your data remains safe and secure, with no deletions having
          occurred; we kindly request that you contact the vendor to restore your
          access, and please note that access may be renewed upon payment of a
          nominal platform fee.
        </p>

        <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
          <svg
            className={refreshing ? 'exp-spin' : ''}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          {refreshing ? 'Checking…' : 'Refresh / Check access'}
        </button>

        {stillExpired && !refreshing && (
          <p className="expired-still">
            Still expired. Once the vendor renews your access, tap Refresh again.
          </p>
        )}

        <p className="expired-foot">
          After renewal, all your data will be available again exactly as before.
        </p>
      </div>
    </div>
  )
}
