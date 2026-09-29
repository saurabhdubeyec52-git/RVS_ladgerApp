import { useState } from 'react'
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
import { CUSTOMER_SEARCH_FIELDS, useCustomerFilters } from './Customers.jsx'

// SQLite stores archived_at as UTC "YYYY-MM-DD HH:MM:SS"; show a readable date.
function formatArchivedAt(value) {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T') + 'Z')
  return isNaN(d) ? value : d.toLocaleDateString()
}

export default function ArchivedUsers() {
  const { t } = useLang()
  const toast = useToast()
  const [toPurge, setToPurge] = useState(null)
  const { data: users, loading, reload } = useListLoader(() => api.users.archived())

  const filters = useCustomerFilters(t)
  const controls = useTableControls(users, { searchFields: CUSTOMER_SEARCH_FIELDS, filters })

  async function restore(id) {
    await api.users.restore(id)
    toast.success(t('toastRestored'))
    reload()
  }

  async function confirmPurge() {
    await api.users.remove(toPurge.id)
    setToPurge(null)
    toast.success(t('toastDeleted'))
    reload()
  }

  return (
    <div className="page list-page">
      <PageHeader title={t('archivedTitle')} />

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
        <div className="empty">{t('noArchivedCustomers')}</div>
      ) : (
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-sno">{t('serialNo')}</th>
              <SortHeader label={t('name')} sortKey="name" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('phone')} sortKey="phone" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('area')} sortKey="area" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('balance')} sortKey="outstanding" sort={controls.sort} onToggle={controls.toggleSort} />
              <SortHeader label={t('archivedOn')} sortKey="archived_at" sort={controls.sort} onToggle={controls.toggleSort} />
              <th className="col-action">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {controls.rows.map((u, i) => (
              <tr key={u.id}>
                <td className="col-sno">{i + 1}</td>
                <td>{u.name}</td>
                <td>{u.phone || '—'}</td>
                <td>{u.area || '—'}</td>
                <td>
                  <MoneyBadge amount={u.outstanding} />
                </td>
                <td>{formatArchivedAt(u.archived_at)}</td>
                <td className="col-action">
                  <ActionMenu
                    items={[
                      { label: t('restore'), onClick: () => restore(u.id) },
                      { label: t('deletePermanently'), danger: true, onClick: () => setToPurge(u) }
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
        open={!!toPurge}
        title={t('purgeCustomerTitle')}
        message={t('purgeCustomerMsg', { name: toPurge?.name })}
        onConfirm={confirmPurge}
        onCancel={() => setToPurge(null)}
      />
    </div>
  )
}
