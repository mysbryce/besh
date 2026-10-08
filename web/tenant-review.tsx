import { useEffect, useRef, useState } from 'react'
import type {
  FlowRowAccess,
  Tenant,
  TenantContext,
} from '../src/workspace/tenant-model'
import { api } from './lib/api'
import { useStudio } from './store'
import { Button } from './components/ui/button'
import { Select } from './components/ui/select'

export function useTenantReview(
  flowId: string | null | undefined,
  source: 'draft' | 'published',
  enabled: boolean,
  revision?: number | null,
) {
  const { member, token, sessionId } = useStudio()
  const [metadata, setMetadata] = useState<FlowRowAccess | null>(null)
  const [context, setContext] = useState<TenantContext | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(false)
  const [known, setKnown] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [reviewedScope, setReviewedScope] = useState('')
  const scope = JSON.stringify([
    flowId,
    source,
    enabled,
    revision,
    member?.id,
    member?.role,
    sessionId,
    token,
    refresh,
  ])
  const request = useRef(0)

  useEffect(() => {
    let active = true
    const sequence = ++request.current
    const current = () => {
      const state = useStudio.getState()
      return (
        active &&
        sequence === request.current &&
        state.member?.id === member?.id &&
        state.token === token &&
        state.sessionId === sessionId
      )
    }
    setKnown(false)
    setMetadata(null)
    setContext(null)
    setTenantId('')
    setTenants([])
    setError('')
    if (!enabled || !flowId || !member) {
      setLoading(false)
      return () => {
        active = false
      }
    }
    setLoading(true)
    void (async () => {
      try {
        const [access, identity] = await Promise.all([
          api<FlowRowAccess>(
            `/api/flows/${flowId}/row-access?source=${source}`,
            token,
          ),
          api<TenantContext>('/api/tenant-context', token),
        ])
        if (!current()) return
        if (revision && access.revision !== revision)
          throw new Error(
            'API revision changed. Refresh the API before reviewing tenant access.',
          )
        const registry =
          access.required && member.role === 'owner'
            ? await api<Tenant[]>('/api/tenants', token)
            : []
        if (!current()) return
        setMetadata(access)
        setContext(identity)
        setTenants(registry.filter((tenant) => tenant.state === 'active'))
        setKnown(true)
        setReviewedScope(scope)
      } catch (reason) {
        if (current())
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not review tenant access.',
          )
      } finally {
        if (current()) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [
    flowId,
    source,
    enabled,
    revision,
    member?.id,
    member?.role,
    token,
    sessionId,
    refresh,
  ])

  const currentScope = reviewedScope === scope
  const required = currentScope && metadata?.required === true
  const selected = tenants.find((tenant) => tenant.id === tenantId)
  const ready =
    enabled &&
    currentScope &&
    known &&
    (!required ||
      (metadata?.supported &&
        (member?.role === 'owner'
          ? !!selected
          : context?.tenant?.state === 'active')))
  return {
    metadata: currentScope ? metadata : null,
    context: currentScope ? context : null,
    tenants: currentScope ? tenants : [],
    tenantId,
    setTenantId,
    loading: loading || (!!enabled && !!flowId && !currentScope && !error),
    known: currentScope && known,
    error,
    required,
    ready,
    owner: member?.role === 'owner',
    refresh: () => setRefresh((value) => value + 1),
    requestTenantId:
      ready && required && member?.role === 'owner' && selected
        ? selected.id
        : undefined,
  }
}

export function TenantReview({
  review,
  disabled = false,
}: {
  review: ReturnType<typeof useTenantReview>
  disabled?: boolean
}) {
  if (review.loading) return <p aria-live="polite">Reviewing tenant access…</p>
  if (review.error)
    return (
      <div className="form-stack">
        <p role="alert" className="form-error">
          {review.error} Refresh tenant access before continuing.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={review.refresh}
        >
          Refresh tenant access
        </Button>
      </div>
    )
  if (!review.required) return null
  return (
    <section
      className="load-test-card form-stack"
      aria-label="Protected API tenant review"
    >
      <h3>Protected tenant rows</h3>
      {!review.metadata?.supported ? (
        <p className="form-error">
          This API shape does not support protected reads. Ask the owner to
          review its request, read and response nodes before running it.
        </p>
      ) : null}
      {review.owner ? (
        <label>
          Reviewed tenant
          <Select
            label="Reviewed tenant"
            value={review.tenantId}
            disabled={disabled}
            placeholder="Choose an active approved tenant"
            options={review.tenants.map((tenant) => ({
              value: tenant.id,
              label: tenant.label,
            }))}
            onValueChange={review.setTenantId}
          />
          <span className="field-help">
            Review this identity for the action below. It is separate from API
            input and does not change member assignment.
          </span>
        </label>
      ) : (
        <p>
          {review.context?.tenant
            ? `Assigned tenant: ${review.context.tenant.label} · ${review.context.tenant.state === 'active' ? 'Active identity' : 'Retired identity'}`
            : 'No tenant assigned. Ask the owner to assign an active tenant before using this protected API.'}{' '}
          Your identity comes from current member assignment; API input cannot
          choose another tenant.
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={review.refresh}
      >
        Refresh tenant access
      </Button>
    </section>
  )
}
