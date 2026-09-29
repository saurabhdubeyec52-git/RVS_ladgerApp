import { useMemo, useState } from 'react'

// Read a field from a row. `field` may be a key string or an accessor function.
function read(row, field) {
  return typeof field === 'function' ? field(row) : row[field]
}

// Treat null/undefined/'—'/'' as "empty" so they always sort to the bottom.
function isEmpty(v) {
  return v === null || v === undefined || v === '' || v === '—'
}

// Type-aware comparison. Numbers compare numerically, date-like strings by time,
// everything else case-insensitively.
function compare(a, b) {
  if (isEmpty(a) && isEmpty(b)) return 0
  if (isEmpty(a)) return 1
  if (isEmpty(b)) return -1

  if (typeof a === 'number' && typeof b === 'number') return a - b

  const da = Date.parse(a)
  const db = Date.parse(b)
  if (!isNaN(da) && !isNaN(db)) return da - db

  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })
}

/**
 * Generic client-side search / sort / filter for table rows.
 *
 * @param {Array} rows
 * @param {Object} config
 * @param {Array<string|Function>} config.searchFields - fields matched by the search box
 * @param {Array} config.filters - [{ key, accessor, type: 'select'|'predicate', options? }]
 *   - 'select': options auto-derived from distinct row values
 *   - 'predicate': options = [{ value, match(row) }]
 */
export function useTableControls(rows, { searchFields = [], filters = [] } = {}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(null) // { key, dir: 'asc' | 'desc' }
  const [filterValues, setFilterValues] = useState({}) // { [key]: value }

  // Cycle a column: asc -> desc -> off.
  function toggleSort(key) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' }
      if (cur.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function setFilter(key, value) {
    setFilterValues((cur) => ({ ...cur, [key]: value }))
  }

  // Distinct, sorted option lists for 'select' filters.
  const filterOptions = useMemo(() => {
    const out = {}
    for (const f of filters) {
      if (f.type === 'select') {
        const set = new Set()
        for (const r of rows) {
          const v = read(r, f.accessor ?? f.key)
          if (!isEmpty(v)) set.add(String(v))
        }
        out[f.key] = [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      }
    }
    return out
  }, [rows, filters])

  const processed = useMemo(() => {
    let out = rows

    // 1) Filters
    for (const f of filters) {
      const value = filterValues[f.key]
      if (!value) continue
      if (f.type === 'predicate') {
        const opt = (f.options || []).find((o) => o.value === value)
        if (opt) out = out.filter((r) => opt.match(r))
      } else {
        out = out.filter((r) => String(read(r, f.accessor ?? f.key)) === value)
      }
    }

    // 2) Search
    const q = query.trim().toLowerCase()
    if (q && searchFields.length) {
      out = out.filter((r) =>
        searchFields.some((field) => {
          const v = read(r, field)
          return !isEmpty(v) && String(v).toLowerCase().includes(q)
        })
      )
    }

    // 3) Sort (stable: sort a copy)
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1
      out = [...out].sort((a, b) => dir * compare(read(a, sort.key), read(b, sort.key)))
    }

    return out
  }, [rows, filters, filterValues, query, searchFields, sort])

  return {
    rows: processed,
    query,
    setQuery,
    sort,
    setSort,
    toggleSort,
    filterValues,
    setFilter,
    filterOptions
  }
}
