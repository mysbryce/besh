import { useEffect, useRef, useState } from 'react'
import type { Tenant } from '../../../src/workspace/tenant-model'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { api, ApiError } from '../../lib/api'
import { useStudio } from '../../stores/studio-store'

export function TenantRegistryEditor({
  tenant,
  onApplied,
  onClose,
}: {
  tenant: Tenant
  onApplied: (tenant: Tenant) => void
  onClose: () => void
}) {
  const { member, token, sessionId, busy, task, message } = useStudio()
  const [record, setRecord] = useState(tenant)
  const [label, setLabel] = useState(tenant.label)
  const [state, setState] = useState<Tenant['state']>(tenant.state)
  const [known, setKnown] = useState(true)
  const [review, setReview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  const request = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)

  function current() {
    const actor = useStudio.getState()
    return (
      active.current &&
      actor.member?.role === 'owner' &&
      actor.member.id === member?.id &&
      actor.token === token &&
      actor.sessionId === sessionId
    )
  }

  useEffect(() => {
    if (member?.role !== 'owner') return
    active.current = true
    if (current()) {
      heading.current?.focus({ preventScroll: true })
      heading.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
    return () => {
      active.current = false
      request.current++
    }
  }, [tenant.id, member?.id, member?.role, token, sessionId])

  async function refresh() {
    if (!current() || pending.current || loading || busy) return
    const sequence = ++request.current
    setLoading(true)
    setKnown(false)
    setReview(false)
    try {
      const records = await api<Tenant[]>('/api/tenants', token)
      if (!current() || sequence !== request.current) return
      const latest = records.find((item) => item.id === tenant.id)
      if (!latest) throw new Error('This tenant is no longer available.')
      setRecord(latest)
      setLabel(latest.label)
      setState(latest.state)
      setKnown(true)
      setError('')
      onApplied(latest)
      message(
        'Tenant refreshed. Review its current label and state before saving.',
      )
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read tenant.'} Refresh tenant before saving.`,
        )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  async function save() {
    if (!current() || pending.current || busy || !known || !review) return
    pending.current = true
    await task(async () => {
      try {
        const latest = await api<Tenant>(
          `/api/tenants/${tenant.id}`,
          token,
          'PUT',
          { label: label.trim(), state, version: record.version },
        )
        if (!current()) return
        onApplied(latest)
        message('Tenant updated. Exact identity value unchanged.')
        onClose()
      } catch (reason) {
        if (!current()) return
        setKnown(false)
        setReview(false)
        setError(
          reason instanceof ApiError && reason.status < 500
            ? `${reason.message} Refresh tenant and review before trying again.`
            : 'Could not confirm whether tenant changes were saved. Refresh tenant to read the current label and state before trying again.',
        )
      }
    })
    pending.current = false
  }

  const disabled = busy || loading || !known
  return (
    <section
      className="load-test-card form-stack"
      aria-label={`Edit tenant ${tenant.label}`}
    >
      <div className="title-actions">
        <h2
          ref={heading}
          tabIndex={-1}
          className="min-w-0 [overflow-wrap:anywhere]"
        >
          Edit tenant {tenant.label}
        </h2>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => void refresh()}
        >
          Refresh tenant
        </Button>
      </div>
      <p className="field-help">
        {known ? 'Reviewed' : 'Last reviewed'} tenant version {record.version}.
        Refresh replaces unsaved label and state choices.
      </p>
      {loading ? <p role="status">Loading tenant…</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <label>
        Tenant label
        <Input
          aria-label="Tenant label"
          value={label}
          maxLength={80}
          disabled={disabled || review}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label>
        Tenant state
        <Select
          label="Tenant state"
          value={state}
          disabled={disabled || review}
          onValueChange={(next) => setState(next as Tenant['state'])}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'retired', label: 'Retired' },
          ]}
        />
      </label>
      <p className="field-help">Immutable exact tenant value</p>
      <code
        aria-label="Immutable tenant value"
        className="whitespace-pre-wrap break-words"
      >
        {record.value}
      </code>
      {review ? (
        <section
          className="load-test-card form-stack"
          aria-label="Review tenant changes"
        >
          <h3>Review tenant changes</h3>
          <p>
            Label: {label.trim()} · State: {state} · Expected version{' '}
            {record.version}
          </p>
          <p>
            {state === 'retired'
              ? 'Retiring this tenant denies assigned tests and callers. Existing keys keep this identity and cannot be retargeted by changing a label.'
              : 'An active tenant can be used by approved assignments and reviewed callers. Activating it does not grant API actions or dependency USE.'}
          </p>
          <p>
            The exact value stays unchanged. Tenant state remains live across
            API releases and rollback.
          </p>
          <div className="title-actions">
            <Button disabled={disabled} onClick={() => void save()}>
              Confirm tenant changes
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
      ) : (
        <Button
          disabled={disabled || !label.trim()}
          onClick={() => setReview(true)}
        >
          Review tenant changes
        </Button>
      )}
      <Button variant="ghost" disabled={busy} onClick={onClose}>
        Close tenant editor
      </Button>
    </section>
  )
}
