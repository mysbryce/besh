import { useEffect, useRef, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import type { Tenant } from '../../../src/workspace/tenant-model'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { api, ApiError } from '../../lib/api'
import { useStudio } from '../../stores/studio-store'
import { TenantRegistryEditor } from './tenant-registry-editor'
import { RowProtection } from '../../components/resource-access/row-protection'

export function TenantProtection() {
  const { member, token, sessionId, busy, task, message } = useStudio()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [known, setKnown] = useState(false)
  const [review, setReview] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const active = useRef(false)
  const request = useRef(0)
  const pending = useRef(false)
  const opener = useRef<HTMLButtonElement | null>(null)

  function current() {
    const state = useStudio.getState()
    return (
      active.current &&
      state.member?.role === 'owner' &&
      state.member.id === member?.id &&
      state.sessionId === sessionId &&
      state.token === token
    )
  }

  async function read(explicit = false) {
    if (!current() || pending.current) return
    const sequence = ++request.current
    setLoading(true)
    setKnown(false)
    setReview(false)
    try {
      const records = await api<Tenant[]>('/api/tenants', token)
      if (!current() || sequence !== request.current) return
      setTenants(records)
      setKnown(true)
      setError('')
      if (explicit)
        message(
          'Tenant registry refreshed. Review current identities before creating another tenant.',
        )
    } catch (reason) {
      if (!current() || sequence !== request.current) return
      setError(
        `${reason instanceof Error ? reason.message : 'Could not read tenants.'} Refresh tenant registry before continuing.`,
      )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (member?.role !== 'owner') return
    active.current = true
    void read()
    return () => {
      active.current = false
      request.current++
    }
  }, [member?.id, member?.role, token, sessionId])

  async function create() {
    if (
      !current() ||
      pending.current ||
      useStudio.getState().busy ||
      !known ||
      !review
    )
      return
    pending.current = true
    await task(async () => {
      try {
        const record = await api<Tenant>('/api/tenants', token, 'POST', {
          label: label.trim(),
          value,
        })
        if (!current()) return
        setTenants((records) => [...records, record])
        setLabel('')
        setValue('')
        setReview(false)
        setError('')
        message('Tenant created. Its exact value cannot be edited.')
      } catch (reason) {
        if (!current()) return
        setReview(false)
        setKnown(false)
        setError(
          reason instanceof ApiError && reason.status < 500
            ? `${reason.message} Refresh tenant registry and review before trying again.`
            : 'Could not confirm whether the tenant was created. Refresh tenant registry to read current identities before trying again.',
        )
      }
    })
    pending.current = false
  }

  if (member?.role !== 'owner')
    return (
      <div className="empty-panel">
        <ShieldCheck />
        <h1>Owner access required</h1>
        <p>
          Only the workspace owner can approve tenant identities and row
          protection.
        </p>
      </div>
    )

  const disabled = busy || loading || !known || !!editingId
  const points = Array.from(value).length
  const bytes = new TextEncoder().encode(value).length
  const valid = !!label.trim() && !!value && points <= 128 && bytes <= 512

  return (
    <div className="form-stack">
      <div className="page-title">
        <div>
          <div className="eyebrow">OWNER-APPROVED DATA BOUNDARY</div>
          <h1>Tenant protection</h1>
          <p>
            Approve exact tenant identities before protecting spreadsheet or
            SQLite rows.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy || loading || !!editingId}
          onClick={() => void read(true)}
        >
          <RefreshCw /> Refresh tenant registry
        </Button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <RowProtection />
      {loading ? <p role="status">Loading tenant protection…</p> : null}
      <section
        className="load-test-card form-stack"
        aria-label="Tenant registry"
      >
        <h2>Approved tenant identities</h2>
        <p>
          Labels help people recognize a tenant. Exact values identify its rows.
          Spaces and case matter; values stay immutable after creation.
        </p>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            if (!disabled && valid) setReview(true)
          }}
        >
          <label>
            Tenant label
            <Input
              aria-label="Tenant label"
              value={label}
              maxLength={80}
              disabled={disabled || review}
              required
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Acme team"
            />
          </label>
          <label>
            Exact tenant value
            <Input
              aria-label="Exact tenant value"
              value={value}
              maxLength={256}
              disabled={disabled || review}
              required
              onChange={(event) => setValue(event.target.value)}
              placeholder="acme"
            />
          </label>
          <p className="field-help">
            No trimming or case conversion. Up to 128 Unicode characters and 512
            UTF-8 bytes. Current value: {points} characters · {bytes} bytes.
          </p>
          {!review ? (
            <Button type="submit" disabled={disabled || !valid}>
              Review new tenant
            </Button>
          ) : null}
        </form>
        {review ? (
          <section
            className="load-test-card form-stack"
            aria-label="Review new tenant"
          >
            <h3>Review new tenant</h3>
            <p>Label: {label.trim()}</p>
            <p>
              Spaces and case are part of the identity. The exact value below
              cannot be edited after creation. Assigning this tenant and
              enabling row protection are separate decisions.
            </p>
            <div className="min-w-0 break-words rounded-xl border p-4">
              <span aria-hidden="true">[</span>
              <code
                aria-label="Reviewed exact tenant value"
                className="whitespace-pre-wrap"
              >
                {value}
              </code>
              <span aria-hidden="true">]</span>
            </div>
            <div className="title-actions">
              <Button disabled={disabled} onClick={() => void create()}>
                Create tenant
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setReview(false)}
              >
                Cancel tenant review
              </Button>
            </div>
          </section>
        ) : null}
        {!loading && known && !tenants.length ? (
          <p>No approved tenants yet.</p>
        ) : null}
        {tenants.map((tenant) => (
          <section
            key={tenant.id}
            className="load-test-card form-stack"
            aria-label={`Tenant ${tenant.label}`}
          >
            <h3 className="min-w-0 [overflow-wrap:anywhere]">
              {tenant.label}{' '}
              <Badge variant="outline">
                {tenant.state} · v{tenant.version}
              </Badge>
            </h3>
            <p className="field-help">Immutable exact tenant value</p>
            <code className="whitespace-pre-wrap break-words">
              {tenant.value}
            </code>
            <Button
              variant="outline"
              disabled={disabled || review}
              className="h-auto min-h-11 whitespace-normal [overflow-wrap:anywhere]"
              onClick={(event) => {
                opener.current = event.currentTarget
                setEditingId(tenant.id)
              }}
            >
              Edit tenant {tenant.label}
            </Button>
          </section>
        ))}
      </section>
      {editingId && tenants.find((tenant) => tenant.id === editingId) ? (
        <TenantRegistryEditor
          key={editingId}
          tenant={tenants.find((tenant) => tenant.id === editingId)!}
          onApplied={(latest) =>
            setTenants((records) =>
              records.map((record) =>
                record.id === latest.id ? latest : record,
              ),
            )
          }
          onClose={() => {
            setEditingId(null)
            requestAnimationFrame(() => {
              if (current()) opener.current?.focus()
            })
          }}
        />
      ) : null}
    </div>
  )
}
