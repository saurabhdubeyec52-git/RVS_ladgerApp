import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatMoney, formatDate } from '../api.js'
import { useLang } from '../i18n.jsx'
import SortHeader from '../components/SortHeader.jsx'
import TableToolbar from '../components/TableToolbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useTableControls } from '../hooks/useTableControls.js'
import { useListLoader } from '../hooks/useListLoader.js'

const TX_SEARCH_FIELDS = ['user_name', 'description']

export default function Transactions() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data: rows, loading } = useListLoader(() => api.tx.all())

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
  const controls = useTableControls(rows, { searchFields: TX_SEARCH_FIELDS, filters: typeFilter })

  return (
    <div className="page list-page">
      <PageHeader title={t('allTransactionsTitle')} />

      {loading ? (
        <div className="empty">{t('loading')}</div>
      ) : rows.length === 0 ? (
        <div className="empty">{t('noTransactionsAll')}</div>
      ) : (
        <>
        <TableToolbar
          query={controls.query}
          setQuery={controls.setQuery}
          placeholder={t('searchPlaceholder')}
          filters={typeFilter}
          filterValues={controls.filterValues}
          setFilter={controls.setFilter}
          filterOptions={controls.filterOptions}
        />
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-sno">{t('serialNo')}</th>
              <SortHeader label={t('customer')} sortKey="user_name" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('date')} sortKey="txn_date" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('type')} sortKey="type" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('amount')} sortKey="amount" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('description')} sortKey="description" sort={controls.sort} onToggle={controls.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {controls.rows.map((tx, i) => (
              <tr
                key={tx.id}
                className="row-click"
                onClick={() => navigate(`/customers/${tx.user_id}`)}
              >
                <td className="col-sno">{i + 1}</td>
                <td>{tx.user_name}</td>
                <td>{formatDate(tx.txn_date)}</td>
                <td>
                  <span className={'pill ' + (tx.type === 'credit' ? 'ok' : 'warn')}>
                    {tx.type === 'credit' ? t('credit') : t('debit')}
                  </span>
                </td>
                <td>{formatMoney(tx.amount)}</td>
                <td>{tx.description || '—'}</td>
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
