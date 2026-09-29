import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useLang } from '../i18n.jsx'
import MoneyBadge from '../components/MoneyBadge.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ActionMenu from '../components/ActionMenu.jsx'
import SortHeader from '../components/SortHeader.jsx'
import TableToolbar from '../components/TableToolbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useTableControls } from '../hooks/useTableControls.js'
import { useListLoader } from '../hooks/useListLoader.js'
import { useToast } from '../context/ToastContext.jsx'

export const CUSTOMER_SEARCH_FIELDS = ['name', 'phone', 'email', 'area', 'address', 'notes']

// Area + balance-status filters shared by the customer list pages.
export function useCustomerFilters(t) {
  return useMemo(
    () => [
      { key: 'area', type: 'select', label: t('filterArea'), allLabel: t('allAreas') },
      {
        key: 'balanceStatus',
        type: 'predicate',
        label: t('balanceStatus'),
        allLabel: t('allStatuses'),
        options: [
          { value: 'owes', label: t('statusOwes'), match: (r) => r.outstanding > 0 },
          { value: 'clear', label: t('statusClear'), match: (r) => r.outstanding === 0 },
          { value: 'advance', label: t('statusAdvance'), match: (r) => r.outstanding < 0 }
        ]
      }
    ],
    [t]
  )
}

export default function Customers() {
  const navigate = useNavigate()
  const { t } = useLang()
  const toast = useToast()
  const [toArchive, setToArchive] = useState(null)
  const { data: users, loading, reload } = useListLoader(() => api.users.list(''))

  const filters = useCustomerFilters(t)
  const controls = useTableControls(users, { searchFields: CUSTOMER_SEARCH_FIELDS, filters })

  // Pre-apply the balance filter when arriving from a dashboard card
  // (e.g. "Total outstanding" → /customers?status=owes).
  const [searchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const { setFilter } = controls
  useEffect(() => {
    if (statusParam) setFilter('balanceStatus', statusParam)
  }, [statusParam, setFilter])

  async function confirmArchive() {
    await api.users.archive(toArchive.id)
    setToArchive(null)
    toast.success(t('toastArchived'))
    reload()
  }

  return (
    <div className="page list-page">
      <PageHeader title={t('customers')}>
        <Link to="/customers/new" className="btn btn-primary">
          {t('registerCustomer')}
        </Link>
      </PageHeader>

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
        <div className="empty">{t('noCustomers')}</div>
      ) : (
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-sno">{t('serialNo')}</th>
              <SortHeader label={t('name')} sortKey="name" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('phone')} sortKey="phone" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('area')} sortKey="area" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('address')} sortKey="address" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('balance')} sortKey="outstanding" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('email')} sortKey="email" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('notes')} sortKey="notes" sort={controls.sort} onToggle={controls.toggleSort} />
              <th className="col-action">{t('actions')}</th>
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
                <td>{u.area || '—'}</td>
                <td>{u.address || '—'}</td>
                <td>
                  <MoneyBadge amount={u.outstanding} />
                </td>
                <td>{u.email || '—'}</td>
                <td>{u.notes || '—'}</td>
                <td className="col-action" onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    items={[
                      { label: t('edit'), onClick: () => navigate(`/customers/${u.id}/edit`) },
                      { label: t('archive'), danger: true, onClick: () => setToArchive(u) }
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <ConfirmDialog
        open={!!toArchive}
        title={t('archiveCustomer')}
        message={t('archiveCustomerMsg', { name: toArchive?.name })}
        onConfirm={confirmArchive}
        onCancel={() => setToArchive(null)}
      />
    </div>
  )
}
