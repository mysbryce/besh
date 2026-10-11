import { useEffect, useRef, useState } from 'react'
import type { Tenant } from '../../../src/workspace/tenant-model'
import { Button } from '../../components/ui/button'
import { Select } from '../../components/ui/select'
import { api, ApiError } from '../../lib/api'
import type { Member } from '../../types/api'
import { useStudio } from '../../stores/studio-store'

export function TenantAssignmentEditor({
  member,
  onRefreshed,
  onClose,
}: {
  member: Member
  onRefreshed: (member: Member) => void
  onClose: () => void
}) {
  const actor = useStudio()
  const [person, setPerson] = useState(member)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState(
    member.tenantAssignment.tenantId ?? 'none',
  )
  const [loading, setLoading] = useState(true)
  const [known, setKnown] = useState(false)
  const [review, setReview] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  const request = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)

  function current() {
    const state = useStudio.getState()
    return (
      active.current &&
      state.member?.role === 'owner' &&
      state.member.id === actor.member?.id &&
      state.token === actor.token &&
      state.sessionId === actor.sessionId
    )
  }

  async function read(explicit = false) {
    if (!current() || pending.current) return
    const sequence = ++request.current
    setLoading(true)
    setKnown(false)
    setReview(false)
    try {
      const [people, identities] = await Promise.all([
        api<Member[]>('/api/members', actor.token),
        api<Tenant[]>('/api/tenants', actor.token),
      ])
      if (!current() || sequence !== request.current) return
      const latest = people.find((person) => person.id === member.id)
      if (!latest) throw new Error('This member is no longer available.')
      setPerson(latest)
      setTenants(identities)
      setTenantId(latest.tenantAssignment.tenantId ?? 'none')
      setKnown(true)
      setError('')
      onRefreshed(latest)
      if (explicit)
        actor.message(
          'Tenant assignment refreshed. Review current identity before saving.',
        )
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read tenant assignment.'} Refresh tenant assignment before saving.`,
        )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (actor.member?.role !== 'owner') return
    active.current = true
    if (current()) {
      heading.current?.focus({ preventScroll: true })
      heading.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
    void read()
    return () => {
      active.current = false
      request.current++
    }
  }, [
    member.id,
    actor.member?.id,
    actor.member?.role,
    actor.token,
    actor.sessionId,
  ])

  async function save() {
    if (!current() || pending.current || actor.busy || !known || !review) return
    pending.current = true
    await actor.task(async () => {
      try {
        const latest = await api<Member>(
          `/api/members/${member.id}/tenant`,
          actor.token,
          'PUT',
          {
            tenantId: tenantId === 'none' ? null : tenantId,
            version: person.tenantAssignment.version,
          },
        )
        if (!current()) return
        setPerson(latest)
        setTenantId(latest.tenantAssignment.tenantId ?? 'none')
        setReview(false)
        setError('')
        onRefreshed(latest)
        actor.message(
          'Tenant assignment updated. Existing API keys keep their original tenant.',
        )
      } catch (reason) {
        if (!current()) return
        setKnown(false)
        setReview(false)
        setError(
          reason instanceof ApiError && reason.status < 500
            ? `${reason.message} Refresh tenant assignment and review before trying again.`
            : 'Could not confirm whether tenant assignment was saved. Refresh tenant assignment to read current identity before trying again.',
        )
      }
    })
    pending.current = false
  }

  const selected = tenants.find((tenant) => tenant.id === tenantId)
  const disabled = actor.busy || loading || !known
  const eligible = tenantId === 'none' || selected?.state === 'active'
  const options = [
    { value: 'none', label: 'No tenant assigned' },
    ...tenants
      .filter((tenant) => tenant.state === 'active' || tenant.id === tenantId)
      .map((tenant) => ({
        value: tenant.id,
        label: `${tenant.label}${tenant.state === 'retired' ? ' · retired' : ''}`,
      })),
  ]

  return (
    <section
      className="load-test-card form-stack"
      aria-label={`Tenant assignment for ${member.name}`}
    >
      <div className="title-actions">
        <h2 ref={heading} tabIndex={-1}>
          Tenant assignment for {member.name}
        </h2>
        <Button
          variant="outline"
          disabled={actor.busy || loading}
          onClick={() => void read(true)}
        >
          Refresh tenant assignment
        </Button>
      </div>
      <p className="field-help">
        {known ? 'Reviewed' : 'Last reviewed'} assignment version{' '}
        {person.tenantAssignment.version}. Refresh replaces unsaved tenant
        choices.
      </p>
      {loading ? <p role="status">Loading tenant assignment…</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <label>
        Assigned tenant
        <Select
          label="Assigned tenant"
          value={tenantId}
          options={options}
          disabled={disabled || review || person.role === 'owner'}
          onValueChange={setTenantId}
        />
      </label>
      <p>
        The server derives this identity for protected actions. Callers cannot
        choose it through request fields. Assignment grants no role actions, API
        sharing or dependency USE.
      </p>
      {tenantId === 'none' ? (
        <p>
          No tenant identity: this member cannot read protected rows. An
          approved tenant with no matching rows receives an empty result.
        </p>
      ) : selected?.state === 'retired' ? (
        <p className="form-error">
          This tenant is retired. Choose an active tenant or remove the
          assignment.
        </p>
      ) : null}
      {review ? (
        <section
          className="load-test-card form-stack"
          aria-label="Review tenant assignment"
        >
          <h3>Review tenant assignment</h3>
          <p>
            {member.name} → {selected?.label ?? 'No tenant assigned'} · Expected
            version {person.tenantAssignment.version}
          </p>
          <p>
            This ends the member’s browser sessions. Existing API keys keep
            their original tenant and may become cleanup-only. Reassignment does
            not retarget them or grant new API access.
          </p>
          <div className="title-actions">
            <Button
              disabled={disabled || !eligible}
              onClick={() => void save()}
            >
              Confirm tenant assignment
            </Button>
            <Button
              variant="outline"
              disabled={actor.busy}
              onClick={() => setReview(false)}
            >
              Cancel assignment review
            </Button>
          </div>
        </section>
      ) : (
        <Button
          disabled={disabled || !eligible || person.role === 'owner'}
          onClick={() => setReview(true)}
        >
          Review tenant assignment
        </Button>
      )}
      <Button variant="ghost" disabled={actor.busy} onClick={onClose}>
        Close tenant assignment
      </Button>
    </section>
  )
}
