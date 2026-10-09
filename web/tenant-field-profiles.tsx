import { useEffect, useRef, useState } from 'react'
import type {
  DatabaseTenantFieldProfile,
  SourceTenantFieldProfile,
  FieldProfile,
  TenantFieldProfileSummary,
} from '../src/workspace/tenant-field-model'
import type { Tenant } from '../src/workspace/tenant-model'
import type { DatabaseConnection } from '../src/databases/model'
import { Button } from './components/ui/button'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { api, ApiError, type DataSource } from './lib/api'
import type {
  DependencySource,
  DependencyDatabase,
} from '../src/workspace/dependency-model'
import { FieldPolicySummary } from './field-policy'
import { useStudio } from './store'

type ApprovedTenant = Pick<Tenant, 'id' | 'label' | 'state' | 'version'>
type Profile = SourceTenantFieldProfile | DatabaseTenantFieldProfile

export function TenantFieldProfiles({
  resource,
  database,
  policyVersion,
  policyInvalidation,
  onSaved,
  onUnconfirmed,
}: {
  resource: DataSource | DatabaseConnection
  database: boolean
  policyVersion: number
  policyInvalidation: number
  onSaved: (version: number) => void
  onUnconfirmed?: () => void
}) {
  const actor = useStudio()
  const [tenants, setTenants] = useState<ApprovedTenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [summary, setSummary] = useState<TenantFieldProfileSummary | null>(null)
  const [summaryKnown, setSummaryKnown] = useState(false)
  const [summaryEpoch, setSummaryEpoch] = useState(policyInvalidation)
  const [schema, setSchema] = useState<DependencySource | DependencyDatabase>(
    resource,
  )
  const [choices, setChoices] = useState<Record<string, FieldProfile>>({})
  const [known, setKnown] = useState(false)
  const [reviewedScope, setReviewedScope] = useState('')
  const [review, setReview] = useState(false)
  const [details, setDetails] = useState(false)
  const [emptyAcknowledged, setEmptyAcknowledged] = useState(false)
  const [wideningAcknowledged, setWideningAcknowledged] = useState(false)
  const [resetAcknowledged, setResetAcknowledged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const active = useRef(false)
  const request = useRef(0)
  const pending = useRef(false)
  const initialRegistryRead = useRef(true)
  const observedInvalidation = useRef(policyInvalidation)
  const heading = useRef<HTMLHeadingElement>(null)
  const namespace = database ? 'database-connections' : 'data-sources'
  const scope = (id: string) =>
    JSON.stringify([
      resource.id,
      resource.version,
      database,
      actor.member?.id,
      actor.member?.role,
      actor.token,
      actor.sessionId,
      id,
      policyInvalidation,
    ])

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

  async function read(id: string) {
    if (!current() || actor.busy || pending.current) return
    const sequence = ++request.current
    setKnown(false)
    setSummaryKnown(false)
    setReview(false)
    setLoading(true)
    setError('')
    try {
      const [latest, metadata, configured] = await Promise.all([
        api<Profile>(
          `/api/${namespace}/${resource.id}/tenant-fields/${id}`,
          actor.token,
        ),
        api<DependencySource | DependencyDatabase>(
          `/api/dependencies/${database ? 'database-connections' : 'sources'}/${resource.id}`,
          actor.token,
        ),
        api<TenantFieldProfileSummary>(
          `/api/${namespace}/${resource.id}/tenant-fields`,
          actor.token,
        ),
      ])
      if (!current() || sequence !== request.current) return
      if (
        latest.resourceVersion !== metadata.version ||
        configured.resourceVersion !== latest.resourceVersion ||
        configured.version !== latest.version
      )
        throw new Error('Resource changed while tenant fields were read.')
      setSummary(configured)
      setSummaryKnown(true)
      setSummaryEpoch(policyInvalidation)
      setProfile(latest)
      setSchema(metadata)
      setChoices(
        'tables' in latest
          ? Object.fromEntries(
              latest.tables.map((table) => [table.table, table.profile]),
            )
          : { [resource.name]: latest.profile },
      )
      setKnown(true)
      setReviewedScope(scope(id))
      setTenants((records) =>
        records.map((tenant) =>
          tenant.id === latest.tenant.id ? latest.tenant : tenant,
        ),
      )
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read tenant API fields.'} Refresh tenant API fields before reviewing.`,
        )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  async function loadRegistry() {
    if (!current() || actor.busy || pending.current) return
    initialRegistryRead.current = false
    const sequence = ++request.current
    setLoading(true)
    setProfile(null)
    setKnown(false)
    setSummaryKnown(false)
    setTenantId('')
    setError('')
    try {
      const [records, configured] = await Promise.all([
        api<Tenant[]>('/api/tenants', actor.token),
        api<TenantFieldProfileSummary>(
          `/api/${namespace}/${resource.id}/tenant-fields`,
          actor.token,
        ),
      ])
      if (!current() || sequence !== request.current) return
      setTenants(
        records.map(({ id, label, state, version }) => ({
          id,
          label,
          state,
          version,
        })),
      )
      setSummary(configured)
      setSummaryKnown(true)
      setSummaryEpoch(policyInvalidation)
      setError('')
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read approved tenants.'} Refresh tenant API fields before reviewing.`,
        )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (actor.member?.role !== 'owner') return
    active.current = true
    initialRegistryRead.current = true
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    void loadRegistry()
    return () => {
      active.current = false
      request.current++
    }
  }, [
    resource.id,
    resource.version,
    database,
    actor.member?.id,
    actor.member?.role,
    actor.token,
    actor.sessionId,
  ])

  useEffect(() => {
    if (!actor.busy && initialRegistryRead.current) void loadRegistry()
  }, [
    actor.busy,
    resource.id,
    resource.version,
    database,
    actor.member?.id,
    actor.member?.role,
    actor.token,
    actor.sessionId,
  ])

  useEffect(() => {
    const invalidated = observedInvalidation.current !== policyInvalidation
    observedInvalidation.current = policyInvalidation
    if (!profile || (!invalidated && profile.version >= policyVersion)) return
    request.current++
    setKnown(false)
    setSummaryKnown(false)
    setReview(false)
    setLoading(false)
    setError(
      (previous) =>
        previous ||
        'Shared policy needs a fresh tenant review. Refresh tenant API fields before reviewing.',
    )
  }, [policyVersion, policyInvalidation, profile?.version])

  const columns = 'columns' in schema ? schema.columns : []
  const tables = profile
    ? 'tables' in profile
      ? profile.tables.map((table) => ({
          ...table,
          columns:
            'tables' in schema
              ? (schema.tables.find((record) => record.name === table.table)
                  ?.columns ?? [])
              : [],
        }))
      : [{ ...profile, table: resource.name, columns }]
    : []
  const reviewedTables = tables.map((table) => {
    const next = choices[table.table] ?? table.profile
    const ceiling =
      table.globalFields.mode === 'all'
        ? table.columns.map((column) => column.key)
        : table.globalFields.columns
    const after =
      next.mode === 'inherit'
        ? ceiling
        : ceiling.filter((key) => next.columns.includes(key))
    return { ...table, next, after }
  })
  const sharesNone = reviewedTables.some(
    (table) => table.next.mode === 'selected' && !table.next.columns.length,
  )
  const widens = reviewedTables.some((table) =>
    table.after.some((key) => !table.effectiveColumns.includes(key)),
  )
  const resets = reviewedTables.some(
    (table) =>
      table.profile.mode === 'selected' && table.next.mode === 'inherit',
  )
  const currentReview =
    known &&
    reviewedScope === scope(tenantId) &&
    (profile?.version ?? 0) >= policyVersion
  const summaryCurrent =
    summaryKnown &&
    summaryEpoch === policyInvalidation &&
    (summary?.version ?? 0) >= policyVersion
  const disabled = actor.busy || loading || !currentReview
  const describe = (keys: string[], tableColumns: typeof columns) =>
    keys.length
      ? keys
          .map(
            (key) =>
              tableColumns.find((column) => column.key === key)?.label ?? key,
          )
          .join(', ')
      : 'No API fields for this tenant'

  function change(table: string, next: FieldProfile) {
    setChoices((current) => ({ ...current, [table]: next }))
    setReview(false)
    setEmptyAcknowledged(false)
    setWideningAcknowledged(false)
    setResetAcknowledged(false)
  }

  async function save() {
    if (
      !current() ||
      pending.current ||
      disabled ||
      !profile ||
      !review ||
      (sharesNone && !emptyAcknowledged) ||
      (widens && !wideningAcknowledged) ||
      (resets && !resetAcknowledged)
    )
      return
    pending.current = true
    const sequence = ++request.current
    await actor.task(async () => {
      try {
        const latest = await api<Profile>(
          `/api/${namespace}/${resource.id}/tenant-fields/${tenantId}`,
          actor.token,
          'PUT',
          {
            version: profile.version,
            resourceVersion: profile.resourceVersion,
            tenantVersion: profile.tenant.version,
            ...('tables' in profile
              ? {
                  tables: profile.tables.map((table) => ({
                    table: table.table,
                    fields: choices[table.table] ?? table.profile,
                  })),
                }
              : { fields: choices[resource.name] ?? profile.profile }),
          },
        )
        if (!current() || sequence !== request.current) return
        setProfile(latest)
        setSummary((previous) => ({
          version: latest.version,
          resourceVersion: latest.resourceVersion,
          configuredTenantIds: [
            ...(previous?.configuredTenantIds ?? []).filter(
              (id) => id !== tenantId,
            ),
            ...(latest.configured ? [tenantId] : []),
          ].sort(),
        }))
        setSummaryKnown(true)
        setSummaryEpoch(policyInvalidation)
        setChoices(
          'tables' in latest
            ? Object.fromEntries(
                latest.tables.map((table) => [table.table, table.profile]),
              )
            : { [resource.name]: latest.profile },
        )
        setReview(false)
        setError('')
        onSaved(latest.version)
        actor.message(
          'Tenant API fields updated. Tenant assignment and caller scope unchanged.',
        )
      } catch (reason) {
        if (!current() || sequence !== request.current) return
        setKnown(false)
        setSummaryKnown(false)
        setReview(false)
        onUnconfirmed?.()
        setError(
          reason instanceof ApiError && reason.status < 500
            ? `${reason.message} Refresh tenant API fields and review before trying again.`
            : 'Could not confirm whether tenant API fields were saved. Refresh tenant API fields to read the current policy before trying again.',
        )
      }
    })
    pending.current = false
  }

  return (
    <section
      className="tenant-field-profiles load-test-card form-stack min-w-0"
      aria-label={`Tenant-specific API fields for ${resource.name}`}
    >
      <div className="title-actions">
        <h2 ref={heading} tabIndex={-1} className="break-words">
          Tenant-specific API fields
        </h2>
        <Button
          variant="outline"
          disabled={actor.busy || loading}
          onClick={() => void (tenantId ? read(tenantId) : loadRegistry())}
        >
          Refresh tenant API fields
        </Button>
        <Button
          variant="ghost"
          aria-expanded={details}
          disabled={actor.busy}
          onClick={() => setDetails(!details)}
        >
          Review details
        </Button>
      </div>
      <p className="field-help">
        {loading
          ? 'Loading field settings'
          : !summaryCurrent || (profile && !currentReview)
            ? 'Refresh needed'
            : profile && !profile.active
              ? 'Inactive field settings'
              : 'Current field settings'}
      </p>
      <p>
        {resource.name}. A tenant choice can narrow the shared API fields; it
        cannot grant a field blocked by the shared policy. Tenant assignment and
        caller scope stay separate. Owner raw previews remain full.
      </p>
      {loading ? <p role="status">Loading tenant API fields…</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <label className="tenant-field-profile-control">
        Approved tenant
        <Select
          label="Approved tenant"
          value={tenantId}
          disabled={actor.busy || loading || !summaryCurrent || !tenants.length}
          placeholder="Choose an approved tenant label"
          options={tenants.map((tenant) => ({
            value: tenant.id,
            label: tenant.label,
          }))}
          onValueChange={(id) => {
            setProfile(null)
            setTenantId(id)
            void read(id)
          }}
        />
      </label>
      {!loading && summaryCurrent && !tenants.length ? (
        <p>Approve a tenant in the registry before reviewing its API fields.</p>
      ) : null}
      {summary ? (
        <section
          className="form-stack min-w-0"
          aria-label="Configured tenant choices"
        >
          <h3>Configured tenant choices</h3>
          {details ? (
            <p className="field-help">
              {summaryCurrent ? 'Reviewed' : 'Last reviewed'} policy version{' '}
              {summary.version}.
            </p>
          ) : null}
          <p className="field-help">
            Only explicit selections are listed. Other approved tenants use
            shared API fields.
          </p>
          {summary.configuredTenantIds.length ? (
            summary.configuredTenantIds.map((id) => {
              const tenant = tenants.find((record) => record.id === id)
              return (
                <Button
                  key={id}
                  variant="outline"
                  className="h-auto min-h-9 justify-start whitespace-normal break-words text-left"
                  disabled={actor.busy || loading || !summaryCurrent || !tenant}
                  onClick={() => {
                    setProfile(null)
                    setTenantId(id)
                    void read(id)
                  }}
                >
                  {tenant
                    ? `${tenant.label}${tenant.state === 'retired' ? ' · Retired identity' : ''}`
                    : `Unavailable approved label · ${id}`}
                </Button>
              )
            })
          ) : (
            <p>No tenant-specific selections saved.</p>
          )}
        </section>
      ) : null}
      {profile ? (
        <>
          {!currentReview ? (
            <p className="form-error">
              Current tenant API fields unknown. Last reviewed fields stay
              visible; Refresh before reviewing another change.
            </p>
          ) : null}
          {details ? (
            <p className="field-help">
              {currentReview ? 'Reviewed' : 'Last reviewed'} resource version{' '}
              {profile.resourceVersion} · Policy version {profile.version} ·
              Tenant version {profile.tenant.version}
            </p>
          ) : null}
          <p>
            {profile.tenant.label} ·{' '}
            {profile.tenant.state === 'active'
              ? 'Active identity'
              : 'Retired identity'}{' '}
            ·{' '}
            {!currentReview
              ? 'Current application status unknown'
              : profile.active
                ? 'Currently applied to protected API reads'
                : 'Inactive: prospective fields only. Saving does not activate protection or this identity.'}
          </p>
          {reviewedTables.map((table) => (
            <div key={table.table} className="form-stack min-w-0">
              {database ? <h3 className="break-words">{table.table}</h3> : null}
              <h3>
                {currentReview
                  ? 'Shared API fields'
                  : 'Last reviewed shared API fields'}
              </h3>
              <FieldPolicySummary
                fields={table.globalFields}
                columns={table.columns}
              />
              <h3>
                {currentReview
                  ? 'Saved tenant choice'
                  : 'Last reviewed tenant choice'}
              </h3>
              <p className="break-words">
                {table.profile.mode === 'inherit'
                  ? 'Use shared API fields'
                  : describe(table.profile.columns, table.columns)}
              </p>
              <label className="tenant-field-profile-control">
                Tenant field setting
                <Select
                  label={
                    database
                      ? `Tenant API field choice for ${table.table}`
                      : 'Tenant API field choice'
                  }
                  value={table.next.mode}
                  disabled={disabled || review}
                  onValueChange={(mode) =>
                    change(
                      table.table,
                      mode === 'inherit'
                        ? { mode: 'inherit' }
                        : { mode: 'selected', columns: [] },
                    )
                  }
                  options={[
                    { value: 'inherit', label: 'Use shared API fields' },
                    {
                      value: 'selected',
                      label: 'Choose fields for this tenant',
                    },
                  ]}
                />
              </label>
              {table.next.mode === 'selected' ? (
                <div className="form-stack min-w-0">
                  {table.columns.map((column) => {
                    const allowed =
                      table.globalFields.mode === 'all' ||
                      table.globalFields.columns.includes(column.key)
                    return (
                      <label
                        key={column.key}
                        className="flex min-w-0 items-start gap-3"
                      >
                        <Checkbox
                          aria-label={`Allow tenant API field ${column.label}`}
                          disabled={disabled || review}
                          checked={
                            table.next.mode === 'selected' &&
                            table.next.columns.includes(column.key)
                          }
                          onCheckedChange={(checked) => {
                            if (table.next.mode !== 'selected') return
                            change(table.table, {
                              mode: 'selected',
                              columns:
                                checked === true
                                  ? [...table.next.columns, column.key]
                                  : table.next.columns.filter(
                                      (key) => key !== column.key,
                                    ),
                            })
                          }}
                        />
                        <span className="min-w-0 break-words">
                          {column.label}
                          {!allowed
                            ? ' · Blocked by shared policy; a saved choice stays stored.'
                            : ''}
                        </span>
                      </label>
                    )
                  })}
                  {!table.next.columns.length ? (
                    <p className="form-error">
                      No API fields for this tenant. Protected API reads using
                      this empty selection stop.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="field-help">
                  Use the shared policy, including future columns it allows.
                </p>
              )}
              <h3>
                {!currentReview
                  ? 'Last reviewed usable API fields'
                  : profile.active
                    ? 'Currently usable API fields'
                    : 'Prospective API fields'}
              </h3>
              <p className="break-words">
                {table.effectiveColumns.length
                  ? table.effectiveColumns
                      .map(
                        (key) =>
                          table.columns.find((column) => column.key === key)
                            ?.label ?? key,
                      )
                      .join(', ')
                  : 'No API fields for this tenant'}
              </p>
            </div>
          ))}
          {review ? (
            <section
              className="load-test-card form-stack min-w-0"
              aria-label="Review tenant API fields"
            >
              <h3>Review tenant API fields</h3>
              <p className="break-words">
                {resource.name} · {profile.tenant.label}
              </p>
              {details ? (
                <p className="field-help">
                  Resource version {profile.resourceVersion} · Policy version{' '}
                  {profile.version} · Tenant version {profile.tenant.version}
                </p>
              ) : null}
              {reviewedTables.map((table) => (
                <div key={table.table} className="form-stack min-w-0">
                  {database ? (
                    <h4 className="break-words">{table.table}</h4>
                  ) : null}
                  <p className="break-words">
                    Saved choice:{' '}
                    {table.profile.mode === 'inherit'
                      ? 'Use shared API fields'
                      : describe(table.profile.columns, table.columns)}
                  </p>
                  <p className="break-words">
                    New choice:{' '}
                    {table.next.mode === 'inherit'
                      ? 'Use shared API fields'
                      : describe(table.next.columns, table.columns)}
                  </p>
                  <p className="break-words">
                    Fields before saving:{' '}
                    {describe(table.effectiveColumns, table.columns)}
                  </p>
                  <p className="break-words">
                    Fields after saving: {describe(table.after, table.columns)}
                  </p>
                </div>
              ))}
              <p>
                This changes live protected projections and business filters,
                including owner tests and old pinned releases. Replies are not
                redacted and API rules are not rewritten. Existing WebSockets
                using this resource close, including other tenants, and pending
                reads may stop.
              </p>
              {!profile.active ? (
                <p>
                  This choice remains inactive. Saving does not activate
                  resource protection or this tenant. The intersection shown is
                  prospective.
                </p>
              ) : null}
              {sharesNone ? (
                <label className="flex min-w-0 items-start gap-3">
                  <Checkbox
                    checked={emptyAcknowledged}
                    disabled={actor.busy}
                    aria-label="I understand this tenant selection blocks its API reads"
                    onCheckedChange={(value) =>
                      setEmptyAcknowledged(value === true)
                    }
                  />
                  <span className="min-w-0 break-words">
                    I understand this tenant selection blocks its API reads.
                  </span>
                </label>
              ) : null}
              {widens ? (
                <label className="flex min-w-0 items-start gap-3">
                  <Checkbox
                    checked={wideningAcknowledged}
                    disabled={actor.busy}
                    aria-label="I understand this tenant may receive more API fields"
                    onCheckedChange={(value) =>
                      setWideningAcknowledged(value === true)
                    }
                  />
                  <span className="min-w-0 break-words">
                    I understand this tenant may receive more API fields.
                  </span>
                </label>
              ) : null}
              {resets ? (
                <label className="flex min-w-0 items-start gap-3">
                  <Checkbox
                    checked={resetAcknowledged}
                    disabled={actor.busy}
                    aria-label="I understand this restores shared API fields"
                    onCheckedChange={(value) =>
                      setResetAcknowledged(value === true)
                    }
                  />
                  <span className="min-w-0 break-words">
                    I understand this restores shared API fields, including
                    future columns allowed by the shared policy.
                  </span>
                </label>
              ) : null}
              <div className="tenant-field-review-actions title-actions">
                <Button
                  disabled={
                    disabled ||
                    (sharesNone && !emptyAcknowledged) ||
                    (widens && !wideningAcknowledged) ||
                    (resets && !resetAcknowledged)
                  }
                  onClick={() => void save()}
                >
                  Confirm tenant API fields
                </Button>
                <Button
                  variant="outline"
                  disabled={actor.busy}
                  onClick={() => setReview(false)}
                >
                  Cancel tenant field review
                </Button>
              </div>
            </section>
          ) : (
            <Button
              disabled={disabled}
              onClick={() => {
                setReview(true)
                setEmptyAcknowledged(false)
                setWideningAcknowledged(false)
                setResetAcknowledged(false)
              }}
            >
              Review tenant API fields
            </Button>
          )}
        </>
      ) : null}
    </section>
  )
}
