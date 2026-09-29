import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useLang } from '../i18n.jsx'
import { api } from '../api.js'
import ActionMenu from './ActionMenu.jsx'
import logo from '../assets/logo.png'

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export default function Sidebar({ overdueCount }) {
  const { user, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const { t, toggle: toggleLang } = useLang()
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    let active = true
    api.app.version()
      .then((version) => { if (active) setAppVersion(version) })
      .catch(() => { if (active) setAppVersion('—') })
    return () => { active = false }
  }, [])

  const link = ({ isActive }) => 'nav-link' + (isActive ? ' active' : '')

  const gearItems = [
    {
      label: `${theme === 'light' ? '🌙' : '☀'} ${t('changeTheme')}`,
      onClick: toggleTheme
    },
    { label: `🌐 ${t('changeLanguage')}`, onClick: toggleLang },
    { label: `⎋ ${t('logout')}`, danger: true, onClick: logout }
  ]

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-title">
          <img className="brand-logo" src={logo} alt="" />
          <span className="brand-name">{t('appName')}</span>
        </span>
      </div>
      <nav>
        <NavLink to="/" end className={link}>
          {t('dashboard')}
        </NavLink>
        <NavLink to="/customers" className={link}>
          {t('customers')}
        </NavLink>
        <NavLink to="/settled" className={link}>
          {t('settledMenu')}
        </NavLink>
        <NavLink to="/archived" className={link}>
          {t('archivedMenu')}
        </NavLink>
        <NavLink to="/notifications" className={link}>
          {t('notifications')}
          {overdueCount > 0 && <span className="badge">{overdueCount}</span>}
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <div className="who">{t('signedInAs', { name: user?.username })}</div>
        <ActionMenu
          items={gearItems}
          trigger={
            <>
              <GearIcon />
              <span>{t('settings')}</span>
            </>
          }
          triggerClassName="settings-btn"
          triggerLabel={t('settings')}
          align="left"
        />
        {appVersion && (
          <div className="app-version" aria-label={t('appVersion', { version: appVersion })}>
            {t('appVersion', { version: appVersion })}
          </div>
        )}
      </div>
    </aside>
  )
}
