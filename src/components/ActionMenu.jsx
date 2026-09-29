import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function ActionMenu({
  items,
  trigger = '⋯',
  triggerClassName = 'action-trigger',
  triggerLabel = 'Actions',
  align = 'right'
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  function place() {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const width = 180
    const menuH = (items?.length || 0) * 40 + 8
    // Align the menu's left edge under the trigger, or its right edge for the
    // default ⋯ row actions. Keep it within the viewport either way.
    const left = align === 'left' ? r.left : r.right - width
    // Open upward if there isn't room below (e.g. trigger at the bottom).
    const openUp = r.bottom + menuH + 8 > window.innerHeight
    const top = openUp ? Math.max(8, r.top - menuH - 4) : r.bottom + 4
    setPos({
      top,
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8))
    })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (
        !menuRef.current?.contains(e.target) &&
        !btnRef.current?.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onScroll() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="action-menu"
          role="menu"
          style={{ top: pos.top, left: pos.left, minWidth: 180 }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`action-item${item.danger ? ' danger' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
