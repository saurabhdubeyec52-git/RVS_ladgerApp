import { useLang } from '../i18n.jsx'

/**
 * Search box + filter dropdowns for a table/list driven by useTableControls.
 *
 * Props:
 *  - query, setQuery, placeholder
 *  - filters: [{ key, label, type, options? }]
 *      'select'    -> options come from filterOptions[key] (string[])
 *      'predicate' -> options come from f.options ([{ value, label }])
 *  - filterValues, setFilter, filterOptions
 *  - sortControl (optional, for card views): { label, value, onChange, options:[{value,label}] }
 */
export default function TableToolbar({
  query,
  setQuery,
  placeholder,
  filters = [],
  filterValues,
  setFilter,
  filterOptions = {},
  sortControl
}) {
  const { t } = useLang()

  return (
    <div className="table-toolbar">
      <input
        className="search"
        placeholder={placeholder || t('searchTables')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filters.map((f) => {
        const opts =
          f.type === 'predicate'
            ? f.options || []
            : (filterOptions[f.key] || []).map((v) => ({ value: v, label: v }))
        return (
          <select
            key={f.key}
            className="filter-select"
            value={filterValues[f.key] || ''}
            onChange={(e) => setFilter(f.key, e.target.value)}
          >
            <option value="">{f.allLabel || f.label}</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )
      })}

      {sortControl && (
        <select
          className="filter-select"
          value={sortControl.value}
          onChange={(e) => sortControl.onChange(e.target.value)}
        >
          {sortControl.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
