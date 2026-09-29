import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useLang } from '../i18n.jsx'
import { useToast } from '../context/ToastContext.jsx'
import PageHeader from '../components/PageHeader.jsx'

const EMPTY = { name: '', phone: '', email: '', address: '', area: '', notes: '' }

// Reduce any stored phone (e.g. "+91 98765 43210", "919876543210") to its
// 10-digit local part for editing.
function toLocalPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) return d.slice(2)
  if (d.length === 11 && d.startsWith('0')) return d.slice(1)
  return d.slice(-10)
}

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const toast = useToast()
  const isEdit = !!id
  const [form, setForm] = useState(EMPTY)
  const [areas, setAreas] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Existing areas to offer in the picker (user can still type a new one).
  // Wrapped in Promise.resolve so a missing IPC method (e.g. before an Electron
  // restart picks up the new preload) becomes a caught rejection, not a crash.
  useEffect(() => {
    let alive = true
    Promise.resolve()
      .then(() => api.users.areas())
      .then((list) => alive && setAreas(list))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (isEdit) {
      api.users.get(Number(id)).then((u) => {
        setForm({
          name: u.name || '',
          phone: toLocalPhone(u.phone),
          email: u.email || '',
          address: u.address || '',
          area: u.area || '',
          notes: u.notes || ''
        })
      })
    }
  }, [id, isEdit])

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  // Phone accepts digits only, capped at 10 (the +91 prefix is fixed in the UI).
  function updatePhone(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm((f) => ({ ...f, phone: digits }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (!/^\d{10}$/.test(form.phone)) {
      setError(t('phoneInvalid'))
      return
    }

    setBusy(true)
    const payload = { ...form, phone: '+91 ' + form.phone }
    try {
      if (isEdit) {
        await api.users.update(Number(id), payload)
        toast.success(t('toastSaved'))
        navigate(`/customers/${id}`)
      } else {
        const created = await api.users.create(payload)
        toast.success(t('toastSaved'))
        navigate(`/customers/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page form-page">
      <PageHeader title={isEdit ? t('editCustomer') : t('registerCustomer').replace('+ ', '')} />

      <form className="form-card" onSubmit={onSubmit}>
        {error && <div className="alert">{error}</div>}

        <label>{t('nameRequired')}</label>
        <input value={form.name} onChange={update('name')} required autoFocus />

        <label>{t('phoneRequired')}</label>
        <div className="input-group">
          <span className="input-prefix">+91</span>
          <input
            value={form.phone}
            onChange={updatePhone}
            inputMode="numeric"
            maxLength={10}
            placeholder={t('phonePlaceholder')}
            required
          />
        </div>

        <label>{t('areaRequired')}</label>
        {/* Pick an existing area from the list, or type a new one. */}
        <input
          value={form.area}
          onChange={update('area')}
          list="area-options"
          placeholder={t('areaPlaceholder')}
          autoComplete="off"
          required
        />
        <datalist id="area-options">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>

        <label>{t('email')}</label>
        <input type="email" value={form.email} onChange={update('email')} />

        <label>{t('address')}</label>
        <input value={form.address} onChange={update('address')} />

        <label>{t('notes')}</label>
        <textarea rows={3} value={form.notes} onChange={update('notes')} />

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? t('saving') : isEdit ? t('saveChanges') : t('register')}
          </button>
        </div>
      </form>
    </div>
  )
}
