import { formatMoney } from '../api.js'

export default function PromiseHistoryDialog({ open, rows, onClose }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <h3>Promise history</h3>
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <table className="table small">
            <thead>
              <tr>
                <th>#</th>
                <th>Action</th>
                <th>Changed at</th>
                <th>Old amount</th>
                <th>New amount</th>
                <th>Old date</th>
                <th>New date</th>
              </tr>
            </thead>
            <tbody>
              {rows && rows.length > 0 ? (
                rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.action}</td>
                    <td>{r.changedAt}</td>
                    <td>{r.oldAmount != null ? formatMoney(r.oldAmount) : '—'}</td>
                    <td>{r.newAmount != null ? formatMoney(r.newAmount) : '—'}</td>
                    <td>{r.oldDate || '—'}</td>
                    <td>{r.newDate || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>No history</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
