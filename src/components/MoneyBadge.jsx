import { formatMoney } from '../api.js'
import { useLang } from '../i18n.jsx'

// Shows an outstanding amount, coloured by whether the customer owes money.
export default function MoneyBadge({ amount }) {
  const { t } = useLang()
  const value = Number(amount) || 0
  const cls = value > 0 ? 'money owe' : value < 0 ? 'money advance' : 'money clear'
  const label = value > 0 ? t('owes') : value < 0 ? t('advance') : t('settled')
  return (
    <span className={cls}>
      {label} {formatMoney(Math.abs(value))}
    </span>
  )
}
