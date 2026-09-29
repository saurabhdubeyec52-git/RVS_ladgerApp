// A clickable table header that drives a useTableControls sort.
export default function SortHeader({ label, sortKey, sort, onToggle, className }) {
  const active = sort && sort.key === sortKey
  const indicator = active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'
  return (
    <th
      className={'sort-header' + (className ? ' ' + className : '')}
      onClick={() => onToggle(sortKey)}
      role="button"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span className={'sort-ind' + (active ? ' active' : '')}>{indicator}</span>
    </th>
  )
}
