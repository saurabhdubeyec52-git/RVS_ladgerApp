import { useLang } from '../i18n.jsx'

// Segmented ENG / हिंदी switch. Highlights the active language.
export default function LanguageToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        className={'lang-opt' + (lang === 'en' ? ' active' : '')}
        onClick={() => setLang('en')}
      >
        ENG
      </button>
      <button
        className={'lang-opt' + (lang === 'hi' ? ' active' : '')}
        onClick={() => setLang('hi')}
      >
        हिंदी
      </button>
    </div>
  )
}
