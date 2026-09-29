import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, formatMoney } from '../api.js'
import { useLang } from '../i18n.jsx'
import SortHeader from '../components/SortHeader.jsx'
import TableToolbar from '../components/TableToolbar.jsx'
import { useTableControls } from '../hooks/useTableControls.js'

const OVERDUE_SEARCH_FIELDS = ['name', 'phone', 'area', 'address']

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [stats, setStats] = useState(null)
  const [overdue, setOverdue] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, o] = await Promise.all([api.stats.dashboard(), api.pending.overdue()])
      setStats(s)
      setOverdue(o)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return api.sync.onChange(load)
  }, [load])

  async function refresh() {
    setSyncing(true)
    try {
      await api.overdue.refresh()
      await load()
    } finally {
      setSyncing(false)
    }
  }

  const overdueFilters = useMemo(
    () => [{ key: 'area', type: 'select', label: t('filterArea'), allLabel: t('allAreas') }],
    [t]
  )
  const controls = useTableControls(overdue, {
    searchFields: OVERDUE_SEARCH_FIELDS,
    filters: overdueFilters
  })

  if (loading || !stats) return <div className="page">{t('loading')}</div>

  return (
    <div className="page list-page">
      <div className="page-header">
        <h1>{t('dashboard')}</h1>
        <div className="header-actions no-print">
          <button className="btn btn-recheck" onClick={refresh} disabled={syncing}>
            <span className={'recheck-icon' + (syncing ? ' spin' : '')}>↻</span>
            {syncing ? t('syncing') : t('checkOverdue')}
          </button>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            🖨 {t('printPdf')}
          </button>
        </div>
      </div>

      {/* Shown only when printing / saving to PDF */}
      <div className="print-only print-meta">
        {t('generatedOn')}: {new Date().toLocaleString()}
      </div>

      <div className="stats-grid">
        {[
          { key: 'totalCustomers', value: stats.customers, icon: '👥', accent: 'blue', to: '/customers' },
          { key: 'ledgerTransactions', value: stats.transactions, icon: '📒', accent: 'violet', to: '/transactions' },
          { key: 'overduePayments', value: stats.overdue, icon: '⏰', accent: 'red', to: '/notifications' },
          { key: 'pendingFuture', value: stats.pendingFuture, icon: '⌛', accent: 'amber', to: '/pending' },
          {
            key: 'totalOutstanding',
            value: formatMoney(stats.totalOutstanding),
            icon: '💰',
            accent: 'indigo',
            wide: true,
            to: '/customers?status=owes'
          }
        ].map((card) => (
          <div
            key={card.key}
            className={`stat-card stat-clickable accent-${card.accent}${card.wide ? ' stat-wide' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => navigate(card.to)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(card.to)
              }
            }}
          >
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-body">
              <div className="stat-label">{t(card.key)}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-header">
        <h2>{t('overduePayments')}</h2>
        <Link to="/notifications" className="link">
          {t('viewAll')}
        </Link>
      </div>

      {overdue.length === 0 ? (
        <div className="empty">{t('noOverdue')}</div>
      ) : (
        <>
        <TableToolbar
          query={controls.query}
          setQuery={controls.setQuery}
          placeholder={t('searchPlaceholder')}
          filters={overdueFilters}
          filterValues={controls.filterValues}
          setFilter={controls.setFilter}
          filterOptions={controls.filterOptions}
        />
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-sno">{t('serialNo')}</th>
              <SortHeader label={t('customers')} sortKey="name" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('phone')} sortKey="phone" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('area')} sortKey="area" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('address')} sortKey="address" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('amount')} sortKey="amount" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('colPromised')} sortKey="promised_date" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('colDaysOverdue')} sortKey="days_overdue" sort={controls.sort} onToggle={controls.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {controls.rows.map((o, i) => (
              <tr
                key={o.pending_id}
                className="row-click"
                onClick={() => navigate(`/customers/${o.user_id}`)}
              >
                <td className="col-sno">{i + 1}</td>
                <td>{o.name}</td>
                <td>{o.phone || '—'}</td>
                <td>{o.area || '—'}</td>
                <td>{o.address || '—'}</td>
                <td>{formatMoney(o.amount)}</td>
                <td>{o.promised_date}</td>
                <td>
                  <span className="pill danger">{t('daysShort', { n: o.days_overdue })}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}
    </div>
  )
}
