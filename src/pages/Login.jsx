import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../i18n.jsx'
import LanguageToggle from '../components/LanguageToggle.jsx'
import logo from '../assets/logo.png'

export default function Login({ onLicenseExpired }) {
  const { login } = useAuth()
  const { t } = useLang()
  const [needsSetup, setNeedsSetup] = useState(null) // null = loading
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.auth
      .status()
      .then((s) => setNeedsSetup(!s.hasAdmin))
      .catch((e) => setError(e.message))
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (needsSetup) {
        if (password !== confirm) throw new Error(t('passwordsDoNotMatch'))
        await api.auth.createAdmin(username, password)
        const user = await api.auth.login(username, password)
        login(user)
      } else {
        const user = await api.auth.login(username, password)
        login(user)
      }
    } catch (err) {
      // Login was blocked because the license expired since this screen loaded.
      // Re-check the license so the app switches to the Expired screen instead
      // of showing the raw error here.
      if (err.message === 'LICENSE_EXPIRED') {
        onLicenseExpired?.()
        return
      }
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (needsSetup === null) return <div className="auth-screen">{t('loading')}</div>

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-lang">
          <LanguageToggle />
        </div>
        <h1 className="auth-brand">
          <img className="brand-logo" src={logo} alt="" />
          {t('appName')}
        </h1>
        {needsSetup && <h2>{t('createAdminTitle')}</h2>}
        {error && <div className="alert">{error}</div>}

        <label>{t('username')}</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />

        <label>{t('password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {needsSetup && (
          <>
            <label>{t('confirmPassword')}</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </>
        )}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? t('pleaseWait') : needsSetup ? t('createAccount') : t('signIn')}
        </button>
      </form>
    </div>
  )
}
