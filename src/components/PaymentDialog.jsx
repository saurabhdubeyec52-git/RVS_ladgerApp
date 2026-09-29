import { useState, useEffect } from 'react'
import { useLang } from '../i18n.jsx'
import { formatMoney } from '../api.js'

/**
 * Popup from a notification's "Mark as paid". The user enters how much was
 * received and/or a new promised day; an "After update" preview reflects the
 * result live (nothing is saved). Update commits; Back closes without saving.
 */
export default function PaymentDialog({ open, promise, onClose, onSubmit }) {
  const { t } = useLang()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (open && promise) {
      setAmount(String(promise.amount ?? ''))
      setDate(promise.promised_date > today ? promise.promised_date : today)
      setError('')
    }
  }, [open, promise, today])

  if (!open || !promise) return null

  const promised = Number(promise.amount) || 0
  const paid = amount === '' ? 0 : Number(amount)
  const validAmount = !isNaN(paid) && paid >= 0
  const remaining = Math.max(0, promised - (validAmount ? paid : 0))
  const willSettle = validAmount && paid >= promised && paid > 0
  const dateChanged = !!date && date !== promise.promised_date
  // A reschedule only applies when a balance remains after the payment.
  const willReschedule = dateChanged && !willSettle
  const hasChanges = (validAmount && paid > 0) || willReschedule

  async function update() {
    if (!validAmount) {
      setError(t('amountInvalid'))
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit({ amount: paid, promisedDate: willReschedule ? date : null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pay-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('paymentSummary')}</h3>

        {error && <div className="alert">{error}</div>}

        <dl className="pay-summary">
          <dt>{t('name')}</dt>
          <dd>{promise.name}</dd>
          <dt>{t('promisedAmount')}</dt>
          <dd className="money owe">{formatMoney(promised)}</dd>
          <dt>{t('promisedDate')}</dt>
          <dd>
            {promise.promised_date}
            {promise.days_overdue > 0 && (
              <span className="pill danger" style={{ marginLeft: 8 }}>
                {t('daysOverdue', { n: promise.days_overdue })}
              </span>
            )}
          </dd>
          <dt>{t('phone')}</dt>
          <dd>{promise.phone || '—'}</dd>
        </dl>

        <div className="pay-section">
          <label>{t('amountReceived')}</label>
          <div className="input-group">
            <span className="input-prefix">₹</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="pay-section">
          <label>{t('newPromisedDate')}</label>
          <input
            type="date"
            min={today}
            value={date}
            disabled={willSettle}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Live preview — not yet saved */}
        <div className="pay-preview-title">{t('afterUpdate')}</div>
        <dl className="pay-summary preview">
          <dt>{t('paidNow')}</dt>
          <dd>{formatMoney(validAmount ? paid : 0)}</dd>
          <dt>{t('remaining')}</dt>
          <dd className={willSettle ? 'money clear' : 'money owe'}>
            {willSettle ? t('willSettle') : formatMoney(remaining)}
          </dd>
          {willReschedule && (
            <>
              <dt>{t('newPromisedDate')}</dt>
              <dd>{date}</dd>
            </>
          )}
        </dl>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('back')}
          </button>
          <button className="btn btn-primary" onClick={update} disabled={busy || !hasChanges}>
            {t('update')}
          </button>
        </div>
      </div>
    </div>
  )
}
