import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatMoney } from '../api.js'
import { useLang } from '../i18n.jsx'
import SortHeader from '../components/SortHeader.jsx'
import TableToolbar from '../components/TableToolbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useTableControls } from '../hooks/useTableControls.js'
import { useListLoader } from '../hooks/useListLoader.js'

const PENDING_SEARCH_FIELDS = ['name', 'phone', 'area', 'address']

export default function PendingPayments() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data: rows, loading } = useListLoader(() => api.pending.list())

  const filters = useMemo(
    () => [{ key: 'area', type: 'select', label: t('filterArea'), allLabel: t('allAreas') }],
    [t]
  )
  const controls = useTableControls(rows, { searchFields: PENDING_SEARCH_FIELDS, filters })

  return (
    <div className="page list-page">
      <PageHeader title={t('pendingPaymentsTitle')} />

      {loading ? (
        <div className="empty">{t('loading')}</div>
      ) : rows.length === 0 ? (
        <div className="empty">{t('noPendingPayments')}</div>
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
        />
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-sno">{t('serialNo')}</th>
              <SortHeader label={t('amount')} sortKey="amount" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('colPromised')} sortKey="promised_date" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('updatedAt')} sortKey="updated_at" sort={controls.sort} onToggle={controls.toggleSort} />
              <th></th>
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
                <td>{formatMoney(o.amount)}</td>
                <td>{o.promised_date}</td>
                <td>{o.updated_at || '—'}</td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm(t('deleteConfirm')))
                        raw.pending.remove(o.pending_id)
                    }}
                    className="btn-danger"
                  >
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
  )
}
