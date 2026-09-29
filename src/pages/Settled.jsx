import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useLang } from '../i18n.jsx'
import MoneyBadge from '../components/MoneyBadge.jsx'
import SortHeader from '../components/SortHeader.jsx'
import TableToolbar from '../components/TableToolbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useTableControls } from '../hooks/useTableControls.js'
import { useListLoader } from '../hooks/useListLoader.js'
import { CUSTOMER_SEARCH_FIELDS, useCustomerFilters } from './Customers.jsx'

export default function Settled() {
  const navigate = useNavigate()
  const { t } = useLang()
  // Fully settled / clear = nothing outstanding.
  const { data: users, loading } = useListLoader(async () =>
    (await api.users.list('')).filter((u) => u.outstanding <= 0)
  )

  const filters = useCustomerFilters(t)
  const controls = useTableControls(users, { searchFields: CUSTOMER_SEARCH_FIELDS, filters })

  return (
    <div className="page list-page">
      <PageHeader title={t('fullySettled')} />

      <TableToolbar
        query={controls.query}
        setQuery={controls.setQuery}
        placeholder={t('searchPlaceholder')}
        filters={filters}
        filterValues={controls.filterValues}
        setFilter={controls.setFilter}
        filterOptions={controls.filterOptions}
      />

      {loading ? (
        <div className="empty">{t('loading')}</div>
      ) : controls.rows.length === 0 ? (
        <div className="empty">{t('noSettled')}</div>
      ) : (
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-sno">{t('serialNo')}</th>
              <SortHeader label={t('name')} sortKey="name" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('phone')} sortKey="phone" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('email')} sortKey="email" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('address')} sortKey="address" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('balance')} sortKey="outstanding" sort={controls.sort} onToggle={controls.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {controls.rows.map((u, i) => (
              <tr
                key={u.id}
                className="row-click"
                onClick={() => navigate(`/customers/${u.id}`)}
              >
                <td className="col-sno">{i + 1}</td>
                <td>{u.name}</td>
                <td>{u.phone || '—'}</td>
                <td>{u.email || '—'}</td>
                <td>{u.address || '—'}</td>
                <td>
                  <MoneyBadge amount={u.outstanding} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
