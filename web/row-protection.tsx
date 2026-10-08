import { useEffect, useRef, useState } from 'react'
import type {
  SourceRowPolicy,
  DatabaseRowPolicy,
  TenantContext,
} from '../src/workspace/tenant-model'
import type { DatabaseConnection } from '../src/databases/model'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Select } from './components/ui/select'
import { api, ApiError, type DataSource } from './lib/api'
import { useStudio } from './store'

export function RowProtection() {
  const { member, token, sessionId, busy } = useStudio()
  const [sources, setSources] = useState<DataSource[]>([])
  const [sourceId, setSourceId] = useState('')
  const [databases, setDatabases] = useState<DatabaseConnection[]>([])
  const [resourceType, setResourceType] = useState('source')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const resources = resourceType === 'source' ? sources : databases
  const selected = resources.find((source) => source.id === sourceId)

  useEffect(() => {
    if (member?.role !== 'owner') return
    let active = true
    setLoading(true)
    Promise.all([
      api<DataSource[]>('/api/data-sources', token),
      api<DatabaseConnection[]>('/api/database-connections', token),
    ])
      .then(([records, copies]) => {
        const state = useStudio.getState()
        if (
          !active ||
          state.member?.id !== member.id ||
          state.member.role !== 'owner' ||
          state.token !== token ||
          state.sessionId !== sessionId
        )
          return
        setSources(records)
        setDatabases(copies)
        setError('')
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [member?.id, member?.role, token, sessionId, refresh])

  if (member?.role !== 'owner') return null
  return (
    <section
      className="load-test-card form-stack"
      aria-label="Resource row protection"
    >
      <h2>Row protection</h2>
      <Button
        variant="outline"
        disabled={busy || loading}
        onClick={() => {
          setSourceId('')
          setRefresh((value) => value + 1)
        }}
      >
        Refresh resources
      </Button>
      <p>
        Protect supported API reads using an approved tenant’s exact identity.
        Resource policies stay live across drafts, releases and rollback.
      </p>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {loading ? <p role="status">Loading resources…</p> : null}
      <label>
        Resource type
        <Select
          label="Resource type"
          value={resourceType}
          disabled={busy || loading}
          onValueChange={(value) => {
            setResourceType(value)
            setSourceId('')
          }}
          options={[
            { value: 'source', label: 'Spreadsheet source' },
            { value: 'database', label: 'SQLite copy' },
          ]}
        />
      </label>
      <label>
        Protected resource
        <Select
          label="Protected resource"
          value={sourceId}
          disabled={busy || loading || !!error || !resources.length}
          onValueChange={setSourceId}
          placeholder="Choose a resource to review"
          options={resources.map((source) => ({
            value: source.id,
            label: source.name,
          }))}
        />
      </label>
      {!loading && !error && !resources.length ? (
        <p>
          Import a{' '}
          {resourceType === 'source' ? 'spreadsheet source' : 'SQLite copy'}{' '}
          before reviewing row protection.
        </p>
      ) : null}
      {selected ? (
        <ResourceRowProtectionEditor
          key={selected.id}
          source={selected}
          database={resourceType === 'database'}
        />
      ) : null}
    </section>
  )
}

function ResourceRowProtectionEditor({
  source,
  database,
}: {
  source: DataSource | DatabaseConnection
  database: boolean
}) {
  const actor = useStudio()
  const [resource, setResource] = useState(source)
  const [policy, setPolicy] = useState<
    SourceRowPolicy | DatabaseRowPolicy | null
  >(null)
  const [context, setContext] = useState<TenantContext | null>(null)
  const [mode, setMode] = useState<SourceRowPolicy['mode']>('unprotected')
  const [column, setColumn] = useState('')
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [known, setKnown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [review, setReview] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  const request = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const namespace = database ? 'database-connections' : 'data-sources'

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
    setAcknowledged(false)
    try {
      const [latest, resources, security] = await Promise.all([
        api<SourceRowPolicy | DatabaseRowPolicy>(
          `/api/${namespace}/${source.id}/row-policy`,
          actor.token,
        ),
        api<(DataSource | DatabaseConnection)[]>(
          `/api/${namespace}`,
          actor.token,
        ),
        api<TenantContext>('/api/tenant-context', actor.token),
      ])
      if (!current() || sequence !== request.current) return
      const metadata = resources.find((record) => record.id === source.id)
      if (!metadata) throw new Error('This source is no longer available.')
      if (metadata.version !== latest.resourceVersion)
        throw new Error('Resource changed while its policy was read.')
      setResource(metadata)
      setPolicy(latest)
      setContext(security)
      setMode(latest.mode)
      setColumn('column' in latest ? (latest.column ?? '') : '')
      setMappings(
        'tables' in latest
          ? Object.fromEntries(
              latest.tables.map((table) => [table.table, table.column ?? '']),
            )
          : {},
      )
      setKnown(true)
      setError('')
      if (explicit)
        actor.message(
          'Row policy refreshed. Review current resource and policy versions before saving.',
        )
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read row policy.'} Refresh row policy before saving.`,
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
    source.id,
    actor.member?.id,
    actor.member?.role,
    actor.token,
    actor.sessionId,
  ])

  const firstProtection = mode === 'tenant' && !context?.backupsOwnerOnly
  const deprotecting = mode === 'unprotected' && policy?.mode === 'tenant'
  const requiresAcknowledgment = firstProtection || deprotecting
  const disabled = actor.busy || loading || !known
  const eligible =
    mode === 'unprotected' ||
    (policy &&
      ('provenance' in policy
        ? policy.provenance.status === 'available' &&
          policy.provenance.textColumns.includes(column)
        : policy.tables.length > 0 &&
          policy.tables.every((table) =>
            table.textColumns.includes(mappings[table.table]),
          )))

  async function save() {
    if (
      !current() ||
      pending.current ||
      actor.busy ||
      !known ||
      !review ||
      !policy ||
      !eligible ||
      (requiresAcknowledgment && !acknowledged)
    )
      return
    pending.current = true
    await actor.task(async () => {
      try {
        const latest = await api<SourceRowPolicy | DatabaseRowPolicy>(
          `/api/${namespace}/${source.id}/row-policy`,
          actor.token,
          'PUT',
          {
            mode,
            version: policy.version,
            resourceVersion: policy.resourceVersion,
            ...(mode === 'tenant'
              ? database
                ? {
                    tables: (policy as DatabaseRowPolicy).tables.map(
                      (table) => ({
                        table: table.table,
                        column: mappings[table.table],
                      }),
                    ),
                  }
                : { column }
              : {}),
          },
        )
        if (!current()) return
        setPolicy(latest)
        setMode(latest.mode)
        setColumn('column' in latest ? (latest.column ?? '') : '')
        setMappings(
          'tables' in latest
            ? Object.fromEntries(
                latest.tables.map((table) => [table.table, table.column ?? '']),
              )
            : {},
        )
        setContext((current) =>
          current
            ? {
                ...current,
                backupsOwnerOnly:
                  current.backupsOwnerOnly || latest.mode === 'tenant',
              }
            : null,
        )
        setReview(false)
        setAcknowledged(false)
        setError('')
        actor.message('Row protection updated. Resource rows unchanged.')
      } catch (reason) {
        if (!current()) return
        setKnown(false)
        setReview(false)
        setAcknowledged(false)
        setError(
          reason instanceof ApiError && reason.status < 500
            ? `${reason.message} Refresh row policy and review before trying again.`
            : 'Could not confirm whether row protection was saved. Refresh row policy to read current protection before trying again.',
        )
      }
    })
    pending.current = false
  }

  return (
    <section
      className="load-test-card form-stack"
      aria-label={`Row protection for ${source.name}`}
    >
      <div className="title-actions">
        <h2 ref={heading} tabIndex={-1}>
          Row protection for {source.name}
        </h2>
        <Button
          variant="outline"
          disabled={actor.busy || loading}
          onClick={() => void read(true)}
        >
          Refresh row policy
        </Button>
      </div>
      <p className="field-help">
        {known ? 'Reviewed' : 'Last reviewed'} resource version{' '}
        {policy?.resourceVersion ?? resource.version} · Policy version{' '}
        {policy?.version ?? 'unknown'}
      </p>
      {loading ? <p role="status">Loading row policy…</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {context?.backupsOwnerOnly ? (
        <p>
          Backups are owner-only permanently, including old archives and after
          removing row protection.
        </p>
      ) : null}
      <label>
        Row protection mode
        <Select
          label="Row protection mode"
          value={mode}
          disabled={disabled || review}
          onValueChange={(value) => setMode(value as SourceRowPolicy['mode'])}
          options={[
            { value: 'unprotected', label: 'Unprotected' },
            { value: 'tenant', label: 'Tenant rows only' },
          ]}
        />
      </label>
      {mode === 'tenant' && policy && 'provenance' in policy ? (
        <>
          {policy.provenance.status === 'requires-reimport' ? (
            <p className="form-error">
              Original tenant text is unavailable. Reimport the original file or
              explicitly refresh its public Sheet before protecting this source.
              Normalized values cannot reconstruct tenant identity.
            </p>
          ) : null}
          <label>
            Tenant column
            <Select
              label="Tenant column"
              value={column}
              disabled={
                disabled || review || !policy?.provenance.textColumns.length
              }
              placeholder="Choose an eligible original-text column"
              onValueChange={setColumn}
              options={(policy?.provenance.textColumns ?? []).map((key) => ({
                value: key,
                label:
                  ('columns' in resource ? resource.columns : []).find(
                    (column) => column.key === key,
                  )?.label ?? key,
              }))}
            />
          </label>
          <p className="field-help">
            Eligibility uses original imported text, independently of displayed
            business types. Non-null numeric, boolean and date cells are
            ineligible. Missing and unmatched tenant rows stay hidden.
          </p>
          {policy?.provenance.status === 'available' &&
          !policy.provenance.textColumns.length ? (
            <p className="form-error">
              No eligible original-text tenant column. Correct the original file
              and reimport it before enabling protection.
            </p>
          ) : null}
        </>
      ) : mode === 'tenant' && policy && 'tables' in policy ? (
        <>
          <p className="field-help">
            Map every uploaded table to an original SQLite TEXT column. Null,
            missing and unmatched identities stay hidden. Numeric and blob
            identities are ineligible; reimport a corrected copy when needed.
          </p>
          {policy.tables.map((table) => (
            <label key={table.table}>
              Tenant column for {table.table}
              <Select
                label={`Tenant column for ${table.table}`}
                value={mappings[table.table] ?? ''}
                disabled={disabled || review || !table.textColumns.length}
                placeholder="Choose an eligible text column"
                onValueChange={(value) =>
                  setMappings((current) => ({
                    ...current,
                    [table.table]: value,
                  }))
                }
                options={table.textColumns.map((key) => ({
                  value: key,
                  label: key,
                }))}
              />
              {!table.textColumns.length ? (
                <span className="form-error">
                  No eligible text column in {table.table}. Reimport a corrected
                  SQLite copy before protecting all tables.
                </span>
              ) : null}
            </label>
          ))}
        </>
      ) : (
        <p>Unprotected resources do not filter by tenant identity.</p>
      )}
      {review ? (
        <section
          className="load-test-card form-stack"
          aria-label="Review row protection"
        >
          <h3>Review row protection</h3>
          <p>
            {source.name} ·{' '}
            {mode === 'tenant'
              ? database
                ? Object.entries(mappings)
                    .map(([table, key]) => `${table}: ${key}`)
                    .join(' · ')
                : `Tenant column: ${column}`
              : 'Unprotected'}{' '}
            · Resource version {policy?.resourceVersion} · Policy version{' '}
            {policy?.version}
          </p>
          {mode === 'tenant' ? (
            <p>
              Existing keys without a tenant identity lose protected access.
              Unsupported API shapes stop; Besh does not rewrite their graphs.
              Supported reads require one request, one protected read and a
              response returning its data.
            </p>
          ) : (
            <p>
              Removing row protection can expose all rows through delegated
              resource access and authored APIs. Existing tenant-bearing key
              privacy remains; backups stay owner-only permanently.
            </p>
          )}
          {firstProtection ? (
            <>
              <p>
                Backups become owner-only permanently, including existing
                archives and after deprotection. Delegated backup access is
                lost. Ordinary operations do not clear this restriction;
                physically restoring an older database can restore old security
                state.
              </p>
              <label className="flex items-start gap-3">
                <Checkbox
                  checked={acknowledged}
                  disabled={actor.busy}
                  aria-label="I understand backups become owner-only permanently"
                  onCheckedChange={(checked) =>
                    setAcknowledged(checked === true)
                  }
                />
                <span>I understand backups become owner-only permanently</span>
              </label>
            </>
          ) : null}
          {deprotecting ? (
            <label className="flex items-start gap-3">
              <Checkbox
                checked={acknowledged}
                disabled={actor.busy}
                aria-label="I understand delegated access may expose all rows"
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <span>I understand delegated access may expose all rows</span>
            </label>
          ) : null}
          <div className="title-actions">
            <Button
              disabled={
                disabled ||
                !eligible ||
                (requiresAcknowledgment && !acknowledged)
              }
              onClick={() => void save()}
            >
              Confirm row protection
            </Button>
            <Button
              variant="outline"
              disabled={actor.busy}
              onClick={() => {
                setReview(false)
                setAcknowledged(false)
              }}
            >
              Cancel row protection review
            </Button>
          </div>
        </section>
      ) : (
        <Button
          disabled={disabled || !eligible}
          onClick={() => {
            setReview(true)
            setAcknowledged(false)
          }}
        >
          Review row protection
        </Button>
      )}
    </section>
  )
}
