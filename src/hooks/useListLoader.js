import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api.js'

// Loads a list once on mount, re-loads on the global data:changed broadcast,
// and exposes reload() for manual refresh after a mutation. fetchFn may be an
// inline arrow — it's read through a ref so the effect doesn't re-subscribe on
// every render.
export function useListLoader(fetchFn, initial = []) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fetchFn)
  fnRef.current = fetchFn

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fnRef.current())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    return api.sync.onChange(reload)
  }, [reload])

  return { data, loading, reload, setData }
}
