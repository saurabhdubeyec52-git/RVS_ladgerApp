import { useTheme } from '../context/ThemeContext.jsx'
import { useLang } from '../i18n.jsx'

// Segmented Light / Dark switch (reuses the language toggle styling).
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useLang()
  return (
    <div className="lang-toggle theme-toggle" role="group" aria-label="Theme">
      <button
        className={'lang-opt' + (theme === 'light' ? ' active' : '')}
        onClick={() => setTheme('light')}
      >
        ☀ {t('light')}
      </button>
      <button
        className={'lang-opt' + (theme === 'dark' ? ' active' : '')}
        onClick={() => setTheme('dark')}
      >
        🌙 {t('dark')}
      </button>
    </div>
  )
}
