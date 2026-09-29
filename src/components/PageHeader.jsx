import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '../i18n.jsx'

// Standard page header: title on the left preceded by a back arrow, and any
// action buttons on the right followed by a forward arrow. React Router stores a
// position index (`idx`) in window.history.state, which tells us whether a
// previous / next entry exists so the arrows can be disabled accordingly.
// useLocation() is read so this re-renders on every navigation.
export default function PageHeader({ title, children }) {
  const navigate = useNavigate()
  useLocation()
  const { t } = useLang()

  const idx = window.history.state?.idx ?? 0
  const canBack = idx > 0
  const canForward = idx < window.history.length - 1

  return (
    <div className="page-header">
      <div className="page-header-side">
        <button
          className="icon-btn"
          onClick={() => navigate(-1)}
          disabled={!canBack}
          aria-label={t('back')}
          title={t('back')}
        >
          ←
        </button>
        {typeof title === 'string' ? <h1>{title}</h1> : title}
      </div>
      <div className="page-header-side">
        {children}
        <button
          className="icon-btn"
          onClick={() => navigate(1)}
          disabled={!canForward}
          aria-label={t('next')}
          title={t('next')}
        >
          →
        </button>
      </div>
    </div>
  )
}
