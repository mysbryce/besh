import { useEffect, useRef, useState } from 'react'
import type {
  DatabaseMemberFieldProfile,
  DatabaseMemberFieldProfileInput,
  MemberFieldProfileSummary,
  SourceMemberFieldProfile,
  SourceMemberFieldProfileInput,
} from '../../../src/workspace/member-field-model'
import type { DatabaseConnection } from '../../../src/databases/model'
import type { FieldProfile } from '../../../src/workspace/tenant-field-model'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import { Checkbox } from '../ui/checkbox'
import { FieldPolicySummary } from './field-policy'
import { api, ApiError } from '../../lib/api'
import type { DataSource, Member } from '../../types/api'
import { useStudio } from '../../stores/studio-store'

export function MemberFieldProfiles({
  resource,
  database = false,
  policyVersion,
  policyInvalidation,
  onSaved,
  onUnconfirmed,
}: {
  resource: DataSource | DatabaseConnection
  database?: boolean
  policyVersion: number
  policyInvalidation: number
  onSaved: (version: number) => void
  onUnconfirmed: () => void
}) {
  const actor = useStudio()
  const [members, setMembers] = useState<Member[]>([])
  const [membersKnown, setMembersKnown] = useState(false)
  const [summary, setSummary] = useState<MemberFieldProfileSummary | null>(null)
  const [summaryKnown, setSummaryKnown] = useState(false)
  const [summaryEpoch, setSummaryEpoch] = useState(policyInvalidation)
  const [memberId, setMemberId] = useState('')
  const [profile, setProfile] = useState<
    SourceMemberFieldProfile | DatabaseMemberFieldProfile | null
  >(null)
  const [choice, setChoice] = useState<FieldProfile>({ mode: 'inherit' })
  const [tableChoices, setTableChoices] = useState<
    Record<string, FieldProfile>
  >({})
  const [review, setReview] = useState(false)
  const [details, setDetails] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [known, setKnown] = useState(false)
  const [reviewedScope, setReviewedScope] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const active = useRef(false)
  const request = useRef(0)
  const pending = useRef(false)
  const initialMemberRead = useRef(true)
  const observedInvalidation = useRef(policyInvalidation)
  const heading = useRef<HTMLHeadingElement>(null)
  const namespace = database ? 'database-connections' : 'data-sources'
  const columns = 'columns' in resource ? resource.columns : []
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

  async function loadMembers() {
    if (!current() || actor.busy || pending.current) return
    initialMemberRead.current = false
    const sequence = ++request.current
    setLoading(true)
    setMembersKnown(false)
    setSummaryKnown(false)
    setKnown(false)
    setProfile(null)
    setReview(false)
    setAcknowledged(false)
    setMemberId('')
    setError('')
    try {
      const [records, configured] = await Promise.all([
        api<Member[]>('/api/members', actor.token),
        api<MemberFieldProfileSummary>(
          `/api/${namespace}/${resource.id}/member-fields`,
          actor.token,
        ),
      ])
      if (!current() || sequence !== request.current) return
      if (
        configured.resourceVersion !== resource.version ||
        configured.version < policyVersion
      )
        throw new Error('Shared policy changed while member choices were read.')
      setMembers(records.filter((member) => member.role !== 'owner'))
      setMembersKnown(true)
      setSummary(configured)
      setSummaryKnown(true)
      setSummaryEpoch(policyInvalidation)
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read workspace members.'} Refresh member API fields before reviewing.`,
        )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  async function read(id: string) {
    if (!current() || actor.busy || pending.current) return
    const sequence = ++request.current
    setLoading(true)
    setKnown(false)
    setSummaryKnown(false)
    setReview(false)
    setAcknowledged(false)
    setError('')
    try {
      const [latest, configured] = await Promise.all([
        api<SourceMemberFieldProfile | DatabaseMemberFieldProfile>(
          `/api/${namespace}/${resource.id}/member-fields/${id}`,
          actor.token,
        ),
        api<MemberFieldProfileSummary>(
          `/api/${namespace}/${resource.id}/member-fields`,
          actor.token,
        ),
      ])
      if (!current() || sequence !== request.current) return
      if (latest.resourceVersion !== resource.version)
        throw new Error('Resource changed while member fields were read.')
      if (latest.version < policyVersion)
        throw new Error('Shared policy changed while member fields were read.')
      if (
        configured.resourceVersion !== latest.resourceVersion ||
        configured.version !== latest.version
      )
        throw new Error('Shared policy changed while member choices were read.')
      setSummary(configured)
      setSummaryKnown(true)
      setSummaryEpoch(policyInvalidation)
      setProfile(latest)
      if ('tables' in latest)
        setTableChoices(
          Object.fromEntries(
            latest.tables.map((table) => [table.table, table.profile]),
          ),
        )
      else setChoice(latest.profile)
      setKnown(true)
      setReviewedScope(scope(id))
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read member API fields.'} Refresh member API fields before reviewing.`,
        )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (actor.member?.role !== 'owner') return
    active.current = true
    initialMemberRead.current = true
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    void loadMembers()
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
    if (!actor.busy && initialMemberRead.current) void loadMembers()
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
    const outdated =
      (profile && profile.version < policyVersion) ||
      (summary && summary.version < policyVersion)
    if (!invalidated && !outdated) return
    request.current++
    setKnown(false)
    setSummaryKnown(false)
    setReview(false)
    setAcknowledged(false)
    setLoading(false)
    setError(
      (previous) =>
        previous ||
        'Shared policy changed. Refresh member API fields before reviewing.',
    )
  }, [
    policyVersion,
    policyInvalidation,
    profile?.version,
    summary?.version,
    database,
  ])

  const summaryCurrent =
    summaryKnown &&
    summaryEpoch === policyInvalidation &&
    summary?.resourceVersion === resource.version &&
    summary.version >= policyVersion
  const currentReview =
    known &&
    summaryCurrent &&
    reviewedScope === scope(memberId) &&
    (profile?.version ?? 0) >= policyVersion
  const describe = (keys: string[]) =>
    keys.length
      ? keys
          .map(
            (key) => columns.find((column) => column.key === key)?.label ?? key,
          )
          .join(', ')
      : 'No API fields allowed by these policies'
  const disabled = actor.busy || loading || !currentReview
  const sourceProfile = profile && !('tables' in profile) ? profile : null
  const sharedColumns = sourceProfile
    ? sourceProfile.globalFields.mode === 'all'
      ? columns.map((column) => column.key)
      : sourceProfile.globalFields.columns
    : []
  const tenantColumns = sourceProfile?.tenantProfile
    ? sourceProfile.tenantProfile.mode === 'inherit'
      ? sharedColumns
      : sharedColumns.filter(
          (key) =>
            sourceProfile.tenantProfile?.mode === 'selected' &&
            sourceProfile.tenantProfile.columns.includes(key),
        )
    : null
  const proposedColumns =
    tenantColumns === null
      ? null
      : choice.mode === 'inherit'
        ? tenantColumns
        : tenantColumns.filter((key) => choice.columns.includes(key))
  const copyTables =
    profile && 'tables' in profile
      ? profile.tables.map((table) => {
          const tableColumns =
            'tables' in resource
              ? (resource.tables.find((item) => item.name === table.table)
                  ?.columns ?? [])
              : []
          const next = tableChoices[table.table] ?? table.profile
          const shared =
            table.globalFields.mode === 'all'
              ? tableColumns.map((column) => column.key)
              : table.globalFields.columns
          const tenant =
            table.tenantProfile === null
              ? null
              : table.tenantProfile.mode === 'inherit'
                ? shared
                : shared.filter(
                    (key) =>
                      table.tenantProfile?.mode === 'selected' &&
                      table.tenantProfile.columns.includes(key),
                  )
          const after =
            tenant === null
              ? null
              : next.mode === 'inherit'
                ? tenant
                : tenant.filter((key) => next.columns.includes(key))
          return { ...table, columns: tableColumns, next, tenant, after }
        })
      : []

  function change(next: FieldProfile) {
    setChoice(next)
    setReview(false)
    setAcknowledged(false)
  }

  function changeTable(table: string, next: FieldProfile) {
    setTableChoices((previous) => ({ ...previous, [table]: next }))
    setReview(false)
    setAcknowledged(false)
  }

  async function save() {
    if (
      !current() ||
      pending.current ||
      disabled ||
      !profile ||
      !review ||
      !acknowledged
    )
      return
    pending.current = true
    const sequence = ++request.current
    const clocks = {
      version: profile.version,
      resourceVersion: profile.resourceVersion,
      memberAccessVersion: profile.member.accessVersion,
      tenantAssignmentVersion: profile.member.tenantAssignment.version,
      tenantVersion: profile.tenant?.version ?? null,
      roleId: profile.member.roleId,
      roleVersion: profile.member.roleVersion,
    }
    const input:
      SourceMemberFieldProfileInput | DatabaseMemberFieldProfileInput =
      'tables' in profile
        ? {
            ...clocks,
            tables: profile.tables.map((table) => ({
              table: table.table,
              fields: tableChoices[table.table] ?? table.profile,
            })),
          }
        : { ...clocks, fields: choice }
    await actor.task(async () => {
      try {
        const latest = await api<
          SourceMemberFieldProfile | DatabaseMemberFieldProfile
        >(
          `/api/${namespace}/${resource.id}/member-fields/${memberId}`,
          actor.token,
          'PUT',
          input,
        )
        if (!current() || sequence !== request.current) return
        setProfile(latest)
        setSummary((previous) => ({
          version: latest.version,
          resourceVersion: latest.resourceVersion,
          configuredMemberIds: [
            ...(previous?.configuredMemberIds ?? []).filter(
              (id) => id !== memberId,
            ),
            ...(latest.configured ? [memberId] : []),
          ].sort(),
        }))
        setSummaryKnown(true)
        setSummaryEpoch(policyInvalidation)
        if ('tables' in latest)
          setTableChoices(
            Object.fromEntries(
              latest.tables.map((table) => [table.table, table.profile]),
            ),
          )
        else setChoice(latest.profile)
        setKnown(true)
        setReviewedScope(scope(memberId))
        setReview(false)
        setAcknowledged(false)
        setError('')
        onSaved(latest.version)
        actor.message(
          'Member API fields updated. Tenant assignment, API scope, and permissions unchanged.',
        )
      } catch (reason) {
        if (!current() || sequence !== request.current) return
        setKnown(false)
        setSummaryKnown(false)
        setReview(false)
        setAcknowledged(false)
        setError(
          reason instanceof ApiError && reason.status < 500
            ? `${reason.message} Refresh member API fields and review before trying again.`
            : 'Could not confirm whether member API fields were saved. Refresh member API fields to read the current policy before trying again.',
        )
        onUnconfirmed()
      }
    })
    pending.current = false
  }

  if (actor.member?.role !== 'owner') return null

  return (
    <section
      className="tenant-field-profiles load-test-card form-stack min-w-0"
      aria-label={`Member-specific API fields for ${resource.name}`}
    >
      <div className="title-actions">
        <h2 ref={heading} tabIndex={-1} className="break-words">
          Member-specific API fields
        </h2>
        <Button
          variant="outline"
          disabled={actor.busy || loading}
          onClick={() => void (memberId ? read(memberId) : loadMembers())}
        >
          Refresh member API fields
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
      <p>
        {loading
          ? 'Loading field settings'
          : !summaryCurrent || (profile && !currentReview)
            ? 'Refresh needed'
            : profile && !profile.active
              ? 'Inactive field settings'
              : 'Current field settings'}
      </p>
      <p>
        {resource.name}. A member choice can narrow the shared and tenant field
        ceilings. It does not change tenant assignment or caller scope.
      </p>
      <p>
        API action permissions, API access scope, and dependency USE are still
        required. Owner raw previews remain full.
      </p>
      {loading ? <p role="status">Loading member API fields…</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <label className="tenant-field-profile-control">
        Workspace member
        <Select
          label="Workspace member"
          value={memberId}
          placeholder="Choose a workspace member"
          disabled={
            actor.busy ||
            loading ||
            review ||
            !membersKnown ||
            !summaryCurrent ||
            !members.length ||
            (!!profile && !currentReview)
          }
          options={members.map((member) => ({
            value: member.id,
            label: member.name,
          }))}
          onValueChange={(id) => {
            setProfile(null)
            setMemberId(id)
            void read(id)
          }}
        />
      </label>
      {!loading && membersKnown && !members.length ? (
        <p>Add a non-owner member before reviewing member API fields.</p>
      ) : null}
      <section
        className="form-stack min-w-0"
        aria-label="Configured member choices"
      >
        <h3>Configured member choices</h3>
        {!summaryCurrent ? (
          <p>
            Current configured member choices unknown. Refresh before reviewing.
          </p>
        ) : null}
        {summary ? (
          <>
            {details ? (
              <p className="field-help">
                {summaryCurrent ? 'Reviewed' : 'Last reviewed'} resource version{' '}
                {summary.resourceVersion} · Policy version {summary.version}.
              </p>
            ) : null}
            <p className="field-help">
              Only explicit selections are listed. Other members use shared and
              tenant API fields.
            </p>
            {summary.configuredMemberIds.length ? (
              summary.configuredMemberIds.map((id) => {
                const member = members.find((record) => record.id === id)
                return (
                  <p key={id} className="break-words">
                    {member?.name ?? `Unavailable workspace member · ${id}`}
                  </p>
                )
              })
            ) : summaryCurrent ? (
              <p>No member-specific choices saved.</p>
            ) : null}
          </>
        ) : null}
      </section>
      {profile ? (
        <>
          {!currentReview ? (
            <p className="form-error">
              Current member field ceiling unknown. Last reviewed fields stay
              visible; Refresh before reviewing.
            </p>
          ) : null}
          {details ? (
            <p className="field-help">
              {currentReview ? 'Reviewed' : 'Last reviewed'} resource version{' '}
              {profile.resourceVersion} · Policy version {profile.version} ·
              Member access version {profile.member.accessVersion} · Assignment
              version {profile.member.tenantAssignment.version} · Role version{' '}
              {profile.member.roleVersion}
            </p>
          ) : null}
          <p className="break-words">
            {profile.member.name} ·{' '}
            {profile.member.role === 'custom'
              ? 'Custom role'
              : profile.member.role === 'editor'
                ? 'Editor'
                : 'Viewer'}
          </p>
          <section className="form-stack min-w-0" aria-label="Assigned tenant">
            <h3>Assigned tenant</h3>
            {profile.tenant ? (
              <p className="break-words">{profile.tenant.label}</p>
            ) : (
              <p>
                No assigned tenant. Effective fields remain unknown until a
                tenant is assigned.
              </p>
            )}
            <p className="field-help">
              This identity comes from the member assignment. These fields do
              not choose or change it.
            </p>
          </section>
          <p>
            {!currentReview
              ? 'Current policy application unknown'
              : profile.active
                ? 'Field ceiling applies to protected reads. API permissions remain separate.'
                : 'Inactive: prospective field ceiling only. This view does not activate protection or an identity.'}
          </p>
          {'tables' in profile ? (
            <>
              {copyTables.map((table) => {
                const tableColumns = table.columns
                const describeTable = (keys: string[]) =>
                  keys.length
                    ? keys
                        .map(
                          (key) =>
                            tableColumns.find((column) => column.key === key)
                              ?.label ?? key,
                        )
                        .join(', ')
                    : 'No API fields allowed by these policies'
                return (
                  <section
                    key={table.table}
                    className="load-test-card form-stack min-w-0"
                    aria-label={`Member fields for ${table.table}`}
                  >
                    <h3 className="break-words">{table.table}</h3>
                    <section className="form-stack" aria-label="Shared ceiling">
                      <h4>Shared API fields</h4>
                      <FieldPolicySummary
                        fields={table.globalFields}
                        columns={tableColumns}
                      />
                    </section>
                    <section className="form-stack" aria-label="Tenant ceiling">
                      <h4>Tenant API fields</h4>
                      <p className="break-words">
                        {table.tenantProfile === null
                          ? 'Unknown: no assigned tenant'
                          : table.tenantProfile.mode === 'inherit'
                            ? 'Use shared API fields'
                            : describeTable(table.tenantProfile.columns)}
                      </p>
                    </section>
                    <section
                      className="form-stack"
                      aria-label="Saved member choice"
                    >
                      <h4>Member field choice</h4>
                      <p className="break-words">
                        {table.profile.mode === 'inherit'
                          ? 'Use shared and tenant API fields'
                          : describeTable(table.profile.columns)}
                      </p>
                    </section>
                    <label className="tenant-field-profile-control">
                      Member field setting
                      <Select
                        label={`Member API field choice for ${table.table}`}
                        value={table.next.mode}
                        disabled={disabled || review}
                        options={[
                          {
                            value: 'inherit',
                            label: 'Use shared and tenant API fields',
                          },
                          {
                            value: 'selected',
                            label: 'Choose fields for this member',
                          },
                        ]}
                        onValueChange={(mode) =>
                          changeTable(
                            table.table,
                            mode === 'inherit'
                              ? { mode: 'inherit' }
                              : { mode: 'selected', columns: [] },
                          )
                        }
                      />
                    </label>
                    {table.next.mode === 'selected' ? (
                      <div className="form-stack min-w-0">
                        {tableColumns.map((column) => (
                          <label
                            key={column.key}
                            className="flex min-w-0 items-start gap-3"
                          >
                            <Checkbox
                              aria-label={`Allow member API field ${column.label} in ${table.table}`}
                              checked={
                                table.next.mode === 'selected' &&
                                table.next.columns.includes(column.key)
                              }
                              disabled={disabled || review}
                              onCheckedChange={(checked) => {
                                if (table.next.mode !== 'selected') return
                                changeTable(table.table, {
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
                              {table.tenant !== null &&
                              !table.tenant.includes(column.key)
                                ? ' · Blocked by shared or tenant ceiling'
                                : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <section
                      className="form-stack"
                      aria-label="Fields allowed by these policies"
                    >
                      <h4>Fields allowed by these policies</h4>
                      <p className="break-words">
                        {table.effectiveColumns === null
                          ? 'Unknown: no assigned tenant'
                          : describeTable(table.effectiveColumns)}
                      </p>
                    </section>
                  </section>
                )
              })}
              {review ? (
                <section
                  className="load-test-card form-stack min-w-0"
                  aria-label="Review member API fields"
                >
                  <h3>Review member API fields</h3>
                  <p className="break-words">
                    {resource.name} · {profile.member.name} ·{' '}
                    {profile.tenant?.label ?? 'No assigned tenant'}
                  </p>
                  {details ? (
                    <p className="field-help">
                      Policy version {profile.version} · Resource version{' '}
                      {profile.resourceVersion} · Member access version{' '}
                      {profile.member.accessVersion} · Assignment version{' '}
                      {profile.member.tenantAssignment.version} · Tenant version{' '}
                      {profile.tenant?.version ?? 'None'} · Role version{' '}
                      {profile.member.roleVersion}
                    </p>
                  ) : null}
                  {copyTables.map((table) => {
                    const names = (keys: string[]) =>
                      keys.length
                        ? keys
                            .map(
                              (key) =>
                                table.columns.find(
                                  (column) => column.key === key,
                                )?.label ?? key,
                            )
                            .join(', ')
                        : 'No API fields allowed by these policies'
                    return (
                      <section
                        key={table.table}
                        className="form-stack min-w-0"
                        aria-label={`Reviewed member fields for ${table.table}`}
                      >
                        <h4 className="break-words">{table.table}</h4>
                        <p className="break-words">
                          Reviewed member choice:{' '}
                          {table.next.mode === 'inherit'
                            ? 'Use shared and tenant API fields'
                            : names(table.next.columns)}
                        </p>
                        <p className="break-words">
                          Fields allowed after this change:{' '}
                          {table.after === null
                            ? 'Unknown: no assigned tenant'
                            : names(table.after)}
                        </p>
                      </section>
                    )
                  })}
                  <p>
                    This ceiling limits the original member; it does not grant
                    API actions or change tenant assignment. A shared policy
                    change can close sockets and cancel in-flight reads using
                    this resource.
                  </p>
                  <label className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      aria-label="I reviewed the original member, assigned tenant, and field ceilings"
                      checked={acknowledged}
                      disabled={actor.busy}
                      onCheckedChange={(checked) =>
                        setAcknowledged(checked === true)
                      }
                    />
                    <span className="min-w-0 break-words">
                      I reviewed the original member, assigned tenant, and field
                      ceilings.
                    </span>
                  </label>
                  <div className="tenant-field-review-actions title-actions">
                    <Button
                      disabled={disabled || !acknowledged}
                      onClick={() => void save()}
                    >
                      Confirm member API fields
                    </Button>
                    <Button
                      variant="outline"
                      disabled={actor.busy}
                      onClick={() => {
                        setReview(false)
                        setAcknowledged(false)
                      }}
                    >
                      Cancel member review
                    </Button>
                  </div>
                </section>
              ) : (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    setReview(true)
                    setAcknowledged(false)
                  }}
                >
                  Review member API fields
                </Button>
              )}
            </>
          ) : (
            <>
              <section
                className="form-stack min-w-0"
                aria-label="Shared ceiling"
              >
                <h3>Shared API fields</h3>
                <FieldPolicySummary
                  fields={profile.globalFields}
                  columns={columns}
                />
              </section>
              <section
                className="form-stack min-w-0"
                aria-label="Tenant ceiling"
              >
                <h3>Tenant API fields</h3>
                <p className="break-words">
                  {profile.tenantProfile === null
                    ? 'Unknown: no assigned tenant'
                    : profile.tenantProfile.mode === 'inherit'
                      ? 'Use shared API fields'
                      : describe(profile.tenantProfile.columns)}
                </p>
              </section>
              <section
                className="form-stack min-w-0"
                aria-label="Saved member choice"
              >
                <h3>Member field choice</h3>
                <p className="break-words">
                  {profile.profile.mode === 'inherit'
                    ? 'Use shared and tenant API fields'
                    : describe(profile.profile.columns)}
                </p>
              </section>
              <label className="tenant-field-profile-control">
                Member field setting
                <Select
                  label="Member API field choice"
                  value={choice.mode}
                  disabled={disabled || review}
                  options={[
                    {
                      value: 'inherit',
                      label: 'Use shared and tenant API fields',
                    },
                    {
                      value: 'selected',
                      label: 'Choose fields for this member',
                    },
                  ]}
                  onValueChange={(mode) =>
                    change(
                      mode === 'inherit'
                        ? { mode: 'inherit' }
                        : { mode: 'selected', columns: [] },
                    )
                  }
                />
              </label>
              {choice.mode === 'selected' ? (
                <div className="form-stack min-w-0">
                  {columns.map((column) => (
                    <label
                      key={column.key}
                      className="flex min-w-0 items-start gap-3"
                    >
                      <Checkbox
                        aria-label={`Allow member API field ${column.label}`}
                        disabled={disabled || review}
                        checked={choice.columns.includes(column.key)}
                        onCheckedChange={(checked) =>
                          change({
                            mode: 'selected',
                            columns:
                              checked === true
                                ? [...choice.columns, column.key]
                                : choice.columns.filter(
                                    (key) => key !== column.key,
                                  ),
                          })
                        }
                      />
                      <span className="min-w-0 break-words">
                        {column.label}
                        {tenantColumns !== null &&
                        !tenantColumns.includes(column.key)
                          ? ' · Blocked by shared or tenant ceiling'
                          : ''}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              {review ? (
                <section
                  className="load-test-card form-stack min-w-0"
                  aria-label="Review member API fields"
                >
                  <h3>Review member API fields</h3>
                  <p className="break-words">
                    {resource.name} · {profile.member.name} ·{' '}
                    {profile.tenant?.label ?? 'No assigned tenant'}
                  </p>
                  {details ? (
                    <p className="field-help">
                      Policy version {profile.version} · Resource version{' '}
                      {profile.resourceVersion} · Member access version{' '}
                      {profile.member.accessVersion} · Assignment version{' '}
                      {profile.member.tenantAssignment.version} · Tenant version{' '}
                      {profile.tenant?.version ?? 'None'} · Role version{' '}
                      {profile.member.roleVersion}
                    </p>
                  ) : null}
                  <h4>Reviewed member choice</h4>
                  <p className="break-words">
                    {choice.mode === 'inherit'
                      ? 'Use shared and tenant API fields'
                      : describe(choice.columns)}
                  </p>
                  <h4>Fields allowed after this change</h4>
                  <p className="break-words">
                    {proposedColumns === null
                      ? 'Unknown: no assigned tenant'
                      : describe(proposedColumns)}
                  </p>
                  <p>
                    This ceiling limits the original member; it does not grant
                    API actions or change tenant assignment. A shared policy
                    change can close sockets and cancel in-flight reads using
                    this resource.
                  </p>
                  <label className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      aria-label="I reviewed the original member, assigned tenant, and field ceilings"
                      disabled={actor.busy}
                      checked={acknowledged}
                      onCheckedChange={(checked) =>
                        setAcknowledged(checked === true)
                      }
                    />
                    <span className="min-w-0 break-words">
                      I reviewed the original member, assigned tenant, and field
                      ceilings.
                    </span>
                  </label>
                  <div className="tenant-field-review-actions title-actions">
                    <Button
                      disabled={disabled || !acknowledged}
                      onClick={() => void save()}
                    >
                      Confirm member API fields
                    </Button>
                    <Button
                      variant="outline"
                      disabled={actor.busy}
                      onClick={() => {
                        setReview(false)
                        setAcknowledged(false)
                      }}
                    >
                      Cancel member review
                    </Button>
                  </div>
                </section>
              ) : (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    setReview(true)
                    setAcknowledged(false)
                  }}
                >
                  Review member API fields
                </Button>
              )}
              <section
                className="form-stack min-w-0"
                aria-label="Fields allowed by these policies"
              >
                <h3>Fields allowed by these policies</h3>
                <p className="break-words">
                  {profile.effectiveColumns === null
                    ? 'Unknown: no assigned tenant'
                    : describe(profile.effectiveColumns)}
                </p>
                <p className="field-help">
                  The intersection of shared, tenant, and member choices is a
                  field ceiling. It does not grant permission to execute an API.
                </p>
              </section>
            </>
          )}
        </>
      ) : null}
    </section>
  )
}
