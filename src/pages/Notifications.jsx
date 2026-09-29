import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatMoney } from '../api.js'
import { useLang } from '../i18n.jsx'
import TableToolbar from '../components/TableToolbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PaymentDialog from '../components/PaymentDialog.jsx'
import { useTableControls } from '../hooks/useTableControls.js'
import { useListLoader } from '../hooks/useListLoader.js'
import { useToast } from '../context/ToastContext.jsx'

const NOTIF_SEARCH_FIELDS = ['name', 'phone', 'email', 'area', 'address']

export default function Notifications() {
  const navigate = useNavigate()
  const { t } = useLang()
  const toast = useToast()
  const [syncing, setSyncing] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const { data: rows, loading, reload } = useListLoader(() => api.pending.overdue())

  async function refresh() {
    setSyncing(true)
    try {
      await api.overdue.refresh()
      await reload()
    } finally {
      setSyncing(false)
    }
  }

  async function applyUpdate({ amount, promisedDate }) {
    const id = payTarget.pending_id
    let settled = false
    let didPay = false
    let didReschedule = false
    if (amount > 0) {
      const res = await api.pending.recordPayment({ id, amount })
      settled = res.settled
      didPay = true
    }
    // Reschedule the remaining balance only if it wasn't fully settled.
    if (!settled && promisedDate) {
      await api.pending.reschedule({ id, promisedDate })
      didReschedule = true
    }
    setPayTarget(null)
    await reload()

    // One consolidated toast for the whole action.
    if (didPay && didReschedule) toast.success(t('toastPaymentRescheduled'))
    else if (didPay) toast.success(t('toastPaymentRecorded'))
    else if (didReschedule) toast.success(t('toastRescheduled'))
  }

  const filters = useMemo(
    () => [{ key: 'area', type: 'select', label: t('filterArea'), allLabel: t('allAreas') }],
    [t]
  )
  const controls = useTableControls(rows, { searchFields: NOTIF_SEARCH_FIELDS, filters })

  const sortOptions = [
    { value: '', label: t('sortBy') },
    { value: 'days_overdue:desc', label: t('sortDaysOverdue') },
    { value: 'amount:desc', label: t('sortAmountDesc') },
    { value: 'name:asc', label: t('sortNameAsc') }
  ]
  const sortValue = controls.sort ? `${controls.sort.key}:${controls.sort.dir}` : ''
  function onSortChange(v) {
    if (!v) return controls.setSort(null)
    const [key, dir] = v.split(':')
    controls.setSort({ key, dir })
  }

  return (
    <div className="page list-page">
      <PageHeader title={t('overduePayments')}>
        <button className="btn btn-recheck" onClick={refresh} disabled={syncing}>
          <span className={'recheck-icon' + (syncing ? ' spin' : '')}>↻</span>
          {syncing ? t('syncing') : t('recheckNow')}
        </button>
      </PageHeader>

      <p className="muted">{t('notifIntro')}</p>

      {loading ? (
        <div className="empty">{t('loading')}</div>
      ) : rows.length === 0 ? (
        <div className="empty">{t('noOverdueNow')}</div>
      ) : (
        <>
        <TableToolbar
          query={controls.query}
          setQuery={controls.setQuery}
          placeholder={t('searchPlaceholder')}
          filters={filters}
          filterValues={controls.filterValues}
          setFilter={controls.setFilter}
          filterOptions={controls.filterOptions}
          sortControl={{ value: sortValue, onChange: onSortChange, options: sortOptions }}
        />
        {controls.rows.length === 0 ? (
          <div className="empty">{t('noOverdueNow')}</div>
        ) : (
        <div className="notif-list">
          {controls.rows.map((o) => (
            <div key={o.pending_id} className="notif-card">
              <div className="notif-main">
                <div className="notif-top">
                  <h3>{o.name}</h3>
                  <span className="pill danger">{t('daysOverdue', { n: o.days_overdue })}</span>
                </div>
                <div className="notif-amount">
                  {t('pending')}: {formatMoney(o.amount)}
                </div>
                <dl className="kv compact">
                  <dt>{t('promisedDate')}</dt>
                  <dd>{o.promised_date}</dd>
                  <dt>{t('phone')}</dt>
                  <dd>{o.phone || '—'}</dd>
                  <dt>{t('area')}</dt>
                  <dd>{o.area || '—'}</dd>
                  <dt>{t('email')}</dt>
                  <dd>{o.email || '—'}</dd>
                  <dt>{t('address')}</dt>
                  <dd>{o.address || '—'}</dd>
                  {o.notes && (
                    <>
                      <dt>{t('notes')}</dt>
                      <dd>{o.notes}</dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="notif-actions">
                {o.phone && (
                  <a className="btn btn-primary" href={`tel:${o.phone}`}>
                    {t('callPhone', { phone: o.phone })}
                  </a>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate(`/customers/${o.user_id}`)}
                >
                  {t('openProfile')}
                </button>
                <button className="btn btn-ghost" onClick={() => setPayTarget(o)}>
                  {t('markAsPaid')}
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
        </>
      )}

      <PaymentDialog
        open={!!payTarget}
        promise={payTarget}
        onClose={() => setPayTarget(null)}
        onSubmit={applyUpdate}
      />
    </div>
  )
}
