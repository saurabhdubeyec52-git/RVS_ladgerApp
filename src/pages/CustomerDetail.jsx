import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, formatMoney, formatDate } from '../api.js'
import { useLang } from '../i18n.jsx'
import MoneyBadge from '../components/MoneyBadge.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import EditTransactionDialog from '../components/EditTransactionDialog.jsx'
import PromiseHistoryModal from '../components/PromiseHistoryModal.jsx'
import SortHeader from '../components/SortHeader.jsx'
import TableToolbar from '../components/TableToolbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useTableControls } from '../hooks/useTableControls.js'
import { useToast } from '../context/ToastContext.jsx'

const LEDGER_SEARCH_FIELDS = ['description']

// Today's date as a local "YYYY-MM-DD" string (avoids the UTC off-by-one that
// toISOString() can cause around midnight in +ve timezones like IST).
function todayStr() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const toast = useToast()
  const userId = Number(id)

  const [user, setUser] = useState(null)
  const [txns, setTxns] = useState([])
  const [archived, setArchived] = useState([])
  const [promise, setPromise] = useState(null)
  const [promiseHistory, setPromiseHistory] = useState([])
  const [error, setError] = useState('')
  const [purgeId, setPurgeId] = useState(null)

  // Add-transaction form
  const [txType, setTxType] = useState('debit')
  const [txAmount, setTxAmount] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txDate, setTxDate] = useState(todayStr) // defaults to today
  const [image, setImage] = useState(null) // { data, name }
  const fileRef = useRef(null)

  // Image viewer modal
  const [modalImage, setModalImage] = useState(null)

  // Edit-transaction modal (the row being edited, or null)
  const [editTx, setEditTx] = useState(null)

  // Promise form
  const [promiseAmount, setPromiseAmount] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    try {
      const [u, tx, arch, p, history] = await Promise.all([
        api.users.get(userId),
        api.tx.list(userId),
        api.tx.archived(userId),
        api.pending.open(userId),
        api.pending.history(userId)
      ])
      setUser(u)
      setTxns(tx)
      setArchived(arch)
      setPromise(p)
      setPromiseAmount(u && u.outstanding > 0 ? String(u.outstanding) : '')
      setPromiseHistory(history || [])
      setError('')
    } catch (err) {
      console.error('Customer load error', err)
      setError(err.message || String(err))
      setUser(null)
      setTxns([])
      setArchived([])
      setPromise(null)
      setPromiseHistory([])
    }
  }, [userId])

  useEffect(() => {
    load()
    return api.sync.onChange(load)
  }, [load])

  function onPickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage({ data: reader.result, name: file.name })
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function addTx(e) {
    e.preventDefault()
    setError('')
    try {
      await api.tx.add({
        userId,
        type: txType,
        amount: txAmount,
        description: txDesc,
        txnDate: txDate,
        image: image?.data || null
      })
      setTxAmount('')
      setTxDesc('')
      setTxDate(todayStr())
      clearImage()
      await load()
      toast.success(t('toastEntryAdded'))
    } catch (err) {
      setError(err.message)
    }
  }

  async function viewImage(filename) {
    const dataUrl = await api.tx.image(filename)
    if (dataUrl) setModalImage(dataUrl)
  }

  async function savePromise(e) {
    e.preventDefault()
    setError('')
    try {
      await api.pending.set({ userId, amount: promiseAmount, promisedDate: promiseDate })
      setPromiseDate('')
      await load()
      toast.success(t('toastPromiseSaved'))
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeTx(txId) {
    await api.tx.remove(txId)
    await load()
    toast.success(t('toastEntryArchived'))
  }

  async function saveEdit(fields) {
    await api.tx.update({ id: editTx.id, userId, ...fields })
    setEditTx(null)
    await load()
    toast.success(t('toastEntryUpdated'))
  }

  async function restoreTx(txId) {
    await api.tx.restore(txId)
    await load()
    toast.success(t('toastEntryRestored'))
  }

  async function confirmPurge() {
    await api.tx.purge(purgeId)
    setPurgeId(null)
    await load()
    toast.success(t('toastDeleted'))
  }

  const typeFilter = useMemo(
    () => [
      {
        key: 'type',
        type: 'predicate',
        label: t('filterType'),
        allLabel: t('allTypes'),
        options: [
          { value: 'credit', label: t('credit'), match: (r) => r.type === 'credit' },
          { value: 'debit', label: t('debit'), match: (r) => r.type === 'debit' }
        ]
      }
    ],
    [t]
  )
  const ledger = useTableControls(txns, { searchFields: LEDGER_SEARCH_FIELDS, filters: typeFilter })
  const archivedLedger = useTableControls(archived, {
    searchFields: LEDGER_SEARCH_FIELDS,
    filters: typeFilter
  })

  if (!user) return <div className="page">{t('loading')}</div>

  return (
    <div className="page">
      <PageHeader title={user.name}>
        <button className="btn btn-ghost no-print" onClick={() => navigate('/customers')}>
          {t('back')}
        </button>
        <button className="btn btn-ghost no-print" onClick={() => window.print()}>
          🖨 {t('printPdf')}
        </button>
      </PageHeader>

      {/* Shown only when printing / saving to PDF */}
      <div className="print-only print-meta">
        {t('generatedOn')}: {new Date().toLocaleString()}
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="detail-grid">
        {/* Profile */}
        <div className="panel">
          <h3>{t('details')}</h3>
          <dl className="kv">
            <dt>{t('phone')}</dt>
            <dd>{user.phone || '—'}</dd>
            <dt>{t('email')}</dt>
            <dd>{user.email || '—'}</dd>
            <dt>{t('area')}</dt>
            <dd>{user.area || '—'}</dd>
            <dt>{t('address')}</dt>
            <dd>{user.address || '—'}</dd>
            <dt>{t('notes')}</dt>
            <dd>{user.notes || '—'}</dd>
          </dl>
        </div>

        {/* Balances */}
        <div className="panel">
          <h3>{t('balanceTitle')}</h3>
          <div className="balance-row">
            <span>{t('totalDebit')}</span>
            <strong>{formatMoney(user.total_debit)}</strong>
          </div>
          <div className="balance-row">
            <span>{t('totalCredit')}</span>
            <strong>{formatMoney(user.total_credit)}</strong>
          </div>
          <hr />
          <div className="balance-row big">
            <span>{t('outstanding')}</span>
            <MoneyBadge amount={user.outstanding} />
          </div>

          {promise && (
            <div className={'promise-note ' + (promise.status === 'overdue' ? 'overdue' : '')}>
              {t('promiseBy', {
                label: promise.status === 'overdue' ? t('overdueLabel') : t('promisedLabel'),
                amount: formatMoney(promise.amount),
                date: promise.promised_date
              })}
            </div>
          )}
        </div>
      </div>

      <div className="detail-grid no-print">
        {/* Add transaction */}
        <div className="panel">
          <h3>{t('addLedgerEntry')}</h3>
          <form onSubmit={addTx} className="ledger-form">
            <div className="inline-form">
              <select value={txType} onChange={(e) => setTxType(e.target.value)}>
                <option value="debit">{t('debitOption')}</option>
                <option value="credit">{t('creditOption')}</option>
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={t('amountField')}
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                required
              />
              <input
                placeholder={t('descOptional')}
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
              />
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                title={t('date')}
                required
              />
              <div className="upload-wrap">
                <label className="upload-btn">
                  📎 {image ? image.name : t('uploadPhoto')}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={onPickImage}
                  />
                </label>
                {image && (
                  <button type="button" className="link danger" onClick={clearImage}>
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="ledger-form-actions">
              <button className="btn btn-primary">{t('add')}</button>
            </div>
          </form>
        </div>

        {/* Set promised date */}
        <div className="panel">
          <h3>{t('promisedPaymentDate')}</h3>
          {user.outstanding > 0 ? (
            <form onSubmit={savePromise} className="inline-form">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={t('pendingAmountField')}
                value={promiseAmount}
                onChange={(e) => setPromiseAmount(e.target.value)}
                required
              />
              <input
                type="date"
                value={promiseDate}
                onChange={(e) => setPromiseDate(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary">{t('savePromise')}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowHistory(true)}>
                  {t('viewPromiseHistory') || 'View promise history'}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty small">{t('noOutstandingPromise')}</div>
          )}

          {/* History is shown in a modal on demand to avoid inline clutter */}
          <PromiseHistoryModal open={showHistory} onClose={() => setShowHistory(false)} rows={promiseHistory} />
        </div>
      </div>

      {/* Ledger history */}
      <div className="panel">
        <h3>{t('ledgerHistory')}</h3>
        {txns.length === 0 ? (
          <div className="empty small">{t('noTransactions')}</div>
        ) : (
          <>
          <TableToolbar
            query={ledger.query}
            setQuery={ledger.setQuery}
            placeholder={t('searchPlaceholder')}
            filters={typeFilter}
            filterValues={ledger.filterValues}
            setFilter={ledger.setFilter}
            filterOptions={ledger.filterOptions}
          />
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="col-sno">{t('serialNo')}</th>
                <SortHeader label={t('date')} sortKey="txn_date" sort={ledger.sort} onToggle={ledger.toggleSort} />
                <SortHeader label={t('type')} sortKey="type" sort={ledger.sort} onToggle={ledger.toggleSort} />
                <SortHeader label={t('amount')} sortKey="amount" sort={ledger.sort} onToggle={ledger.toggleSort} />
                <SortHeader label={t('description')} sortKey="description" sort={ledger.sort} onToggle={ledger.toggleSort} />
                <th>{t('supportedDocs')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((tx, i) => (
                <tr key={tx.id}>
                  <td className="col-sno">{i + 1}</td>
                  <td>{formatDate(tx.txn_date)}</td>
                  <td>
                    <span className={'pill ' + (tx.type === 'credit' ? 'ok' : 'warn')}>
                      {tx.type === 'credit' ? t('credit') : t('debit')}
                    </span>
                  </td>
                  <td>{formatMoney(tx.amount)}</td>
                  <td>{tx.description || '—'}</td>
                  <td>
                    {tx.image_path ? (
                      <button
                        type="button"
                        className="link photo-link"
                        onClick={() => viewImage(tx.image_path)}
                      >
                        📎 {t('viewPhoto')}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="row-actions no-print">
                    <button className="link" onClick={() => setEditTx(tx)}>
                      {t('edit')}
                    </button>
                    <button className="link danger" onClick={() => removeTx(tx.id)}>
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      {/* Archived data — deleted ledger entries for this customer */}
      <div className="panel">
        <h3>{t('archivedData')}</h3>
        {archived.length === 0 ? (
          <div className="empty small">{t('noArchivedData')}</div>
        ) : (
          <>
          <TableToolbar
            query={archivedLedger.query}
            setQuery={archivedLedger.setQuery}
            placeholder={t('searchPlaceholder')}
            filters={typeFilter}
            filterValues={archivedLedger.filterValues}
            setFilter={archivedLedger.setFilter}
            filterOptions={archivedLedger.filterOptions}
          />
          <div className="table-wrap">
          <table className="table archived-table">
            <thead>
              <tr>
                <th className="col-sno">{t('serialNo')}</th>
                <SortHeader label={t('date')} sortKey="txn_date" sort={archivedLedger.sort} onToggle={archivedLedger.toggleSort} />
                <SortHeader label={t('type')} sortKey="type" sort={archivedLedger.sort} onToggle={archivedLedger.toggleSort} />
                <SortHeader label={t('amount')} sortKey="amount" sort={archivedLedger.sort} onToggle={archivedLedger.toggleSort} />
                <SortHeader label={t('description')} sortKey="description" sort={archivedLedger.sort} onToggle={archivedLedger.toggleSort} />
                <th>{t('supportedDocs')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {archivedLedger.rows.map((tx, i) => (
                <tr key={tx.id}>
                  <td className="col-sno">{i + 1}</td>
                  <td>{formatDate(tx.txn_date)}</td>
                  <td>
                    <span className={'pill ' + (tx.type === 'credit' ? 'ok' : 'warn')}>
                      {tx.type === 'credit' ? t('credit') : t('debit')}
                    </span>
                  </td>
                  <td>{formatMoney(tx.amount)}</td>
                  <td>{tx.description || '—'}</td>
                  <td>
                    {tx.image_path ? (
                      <button
                        type="button"
                        className="link photo-link"
                        onClick={() => viewImage(tx.image_path)}
                      >
                        📎 {t('viewPhoto')}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="archive-actions no-print">
                    <button className="link" onClick={() => restoreTx(tx.id)}>
                      {t('restore')}
                    </button>
                    <button className="link danger" onClick={() => setPurgeId(tx.id)}>
                      {t('deletePermanently')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={purgeId != null}
        title={t('purgeTxTitle')}
        message={t('purgeTxMsg')}
        onConfirm={confirmPurge}
        onCancel={() => setPurgeId(null)}
      />

      <EditTransactionDialog
        open={editTx != null}
        tx={editTx}
        onClose={() => setEditTx(null)}
        onSubmit={saveEdit}
      />

      {modalImage && (
        <div className="modal-overlay" onClick={() => setModalImage(null)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <img src={modalImage} alt="attachment" />
            <button className="btn btn-ghost" onClick={() => setModalImage(null)}>
              {t('closeLabel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
