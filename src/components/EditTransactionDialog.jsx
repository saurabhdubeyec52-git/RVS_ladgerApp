import { useState, useEffect } from 'react'
import { useLang } from '../i18n.jsx'

/**
 * Popup to edit an existing ledger entry (type, amount, description, date).
 * Save commits via onSubmit; Cancel / overlay click closes without saving.
 */
export default function EditTransactionDialog({ open, tx, onClose, onSubmit }) {
  const { t } = useLang()
  const [type, setType] = useState('debit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && tx) {
      setType(tx.type)
      setAmount(String(tx.amount ?? ''))
      setDescription(tx.description || '')
      setDate((tx.txn_date || '').slice(0, 10))
      setError('')
    }
  }, [open, tx])

  if (!open || !tx) return null

  async function save(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSubmit({ type, amount, description, txnDate: date })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('editLedgerEntry')}</h3>

        {error && <div className="alert">{error}</div>}

        <form onSubmit={save}>
          <div className="pay-section">
            <label>{t('type')}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="debit">{t('debitOption')}</option>
              <option value="credit">{t('creditOption')}</option>
            </select>
          </div>

          <div className="pay-section">
            <label>{t('amountField')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="pay-section">
            <label>{t('descOptional')}</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="pay-section">
            <label>{t('date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
