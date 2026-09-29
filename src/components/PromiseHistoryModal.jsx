import { useState } from 'react'
import { formatMoney } from '../api.js'
import { useLang } from '../i18n.jsx'

export default function PromiseHistoryModal({ open, onClose, rows, onDelete }) {
  const { t } = useLang()
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  if (!open) return null
  const overlayStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
  const panelStyle = {
    background: '#fff',
    borderRadius: 8,
    width: '90%',
    maxWidth: 1100,
    maxHeight: '80vh',
    overflow: 'auto',
    padding: 20
  }

  const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return '—'
    // Handle ISO timestamps like "2026-08-23T16:59:30-08:00" or "2026-08-23T16:59:30Z"
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
    const [year, month, day] = datePart.split('-')
    return `${day}-${month}-${year}`
  }

  async function deleteHistoryRow(row) {
    if (!window.confirm(t('deletePromiseHistoryConfirm'))) return

    setDeletingId(row.id)
    setError('')
    try {
      await onDelete(row.id)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{t('promiseHistory')}</h3>
          <button className="btn btn-ghost" onClick={onClose}>{t('closeLabel')}</button>
        </div>

        {error && <div className="alert" role="alert">{error}</div>}

        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Sr.No</th>
              <th>Amount</th>
              <th>NewPromiseDate</th>
              <th>UpdatedAt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows && rows.length > 0 ? (
              rows.map((r, i) => {
                const amount = r.newAmount != null ? Number(r.newAmount) : null
                const newPromiseDate = formatDDMMYYYY(r.newDate)
                const updatedAt = formatDDMMYYYY(r.changedAt)
                return (
                  <tr key={r.id || i}>
                    <td>{i + 1}</td>
                    <td>{amount != null ? formatMoney(amount) : '—'}</td>
                    <td>{newPromiseDate}</td>
                    <td>{updatedAt}</td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteHistoryRow(r)
                        }}
                        className="btn-danger"
                        disabled={deletingId !== null}
                      >
                        {deletingId === r.id ? t('deleting') : t('delete')}
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} className="empty small">{t('noPromiseHistory')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
