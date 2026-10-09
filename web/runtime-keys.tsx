import { useEffect, useRef, useState } from 'react'
import {
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import {
  api,
  ApiError,
  runtimeEndpointPath,
  runtimeEndpointUrl,
  type RuntimeKey,
  type RuntimePermission,
  type SavedFlow,
  type Member,
} from './lib/api'
import { useStudio } from './store'
import { can } from '../src/workspace/permissions'
import { ManualPinnedKeyForm } from './runtime-key-manual'
import { TenantReview, useTenantReview } from './tenant-review'
import { useTenantContext } from './tenant-context'
import { KeyReplacementOptions } from './key-replacement-options'

const permissionLabels: Record<RuntimePermission, string> = {
  rest: 'REST requests',
  query: 'GraphQL queries',
  mutation: 'GraphQL mutations',
  ws: 'WebSocket messages',
}

function releaseLabel(key: { releaseRevision: number | null }) {
  return key.releaseRevision === null
    ? 'Follow published changes'
    : `Only release ${key.releaseRevision}`
}

function issuerLabel(
  key: Pick<RuntimeKey, 'issuerBinding'>,
  member: Member | null,
) {
  const binding = key.issuerBinding
  if (!binding) return 'No member link'
  return `Linked to ${binding.memberId === member?.id ? `member ${member.name}` : `original member (${binding.memberId.slice(0, 8)})`} · ${binding.action === 'load-tests.run' ? 'Load testing' : 'API key management'}`
}

type Pin = {
  flowId: string
  revision: number
  endpoint: NonNullable<SavedFlow['publishedEndpoint']>
}
type Creation = {
  name: string
  flowId: string
  permissions: RuntimePermission[]
  expiresAt: string
  releaseRevision?: number
  apiName: string
  route: string
  tenantId?: string
  tenantLabel?: string
}

export function RuntimeKeys() {
  const token = useStudio((state) => state.token)
  const member = useStudio((state) => state.member)
  const sessionId = useStudio((state) => state.sessionId)
  const flows = useStudio((state) => state.flows)
  const busy = useStudio((state) => state.busy)
  const task = useStudio((state) => state.task)
  const message = useStudio((state) => state.message)
  const [keys, setKeys] = useState<RuntimeKey[]>([])
  const [name, setName] = useState('')
  const [flowId, setFlowId] = useState('')
  const [days, setDays] = useState('30')
  const [scope, setScope] = useState<{
    flowId: string
    permissions: RuntimePermission[]
  } | null>(null)
  const [issued, setIssued] = useState('')
  const [issuedRecord, setIssuedRecord] = useState<RuntimeKey | null>(null)
  const [pin, setPin] = useState<Pin | null>(null)
  const [review, setReview] = useState<Creation | null>(null)
  const [metadataKnown, setMetadataKnown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [manualReviewNeeded, setManualReviewNeeded] = useState(false)
  const [creationUnconfirmed, setCreationUnconfirmed] = useState(false)
  const [replacementOptions, setReplacementOptions] =
    useState<RuntimeKey | null>(null)
  const [replacementUnconfirmed, setReplacementUnconfirmed] = useState(false)
  const [deadlineReviewId, setDeadlineReviewId] = useState<string | null>(null)
  const [issuedPredecessor, setIssuedPredecessor] = useState<RuntimeKey | null>(
    null,
  )
  const active = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const readable = can(member, 'flows.read')
  const selectedAccess = member?.access.mode === 'selected'
  const published = readable
    ? flows.filter((flow) => flow.publishedEndpoint)
    : []
  const selected = published.find((flow) => flow.id === flowId) ?? published[0]
  const selectedPin = pin?.flowId === selected?.id ? pin : null
  const endpoint = selectedPin?.endpoint ?? selected?.publishedEndpoint
  const websocket = endpoint?.transport === 'websocket'
  const currentWebSocket =
    selected?.publishedEndpoint?.transport === 'websocket'
  const permissions: RuntimePermission[] =
    scope && scope.flowId === selected?.id
      ? scope.permissions
      : websocket
        ? ['ws']
        : endpoint?.graphql
          ? ['query']
          : ['rest']
  const availablePermissions: RuntimePermission[] = websocket
    ? ['ws']
    : endpoint?.graphql
      ? ['query', 'mutation']
      : ['rest']
  const locked = busy || loading || !!issued
  const tenantReview = useTenantReview(
    selected?.id,
    'published',
    readable && !!selected?.publishedRevision,
  )
  const requiresPin =
    selectedAccess || tenantReview.required || currentWebSocket
  const ownTenantContext = useTenantContext(can(member, 'runtime-keys.manage'))

  useEffect(() => {
    if (
      (tenantReview.required || currentWebSocket) &&
      selected?.publishedRevision &&
      selected.publishedEndpoint
    )
      setPin((previous) =>
        previous?.flowId === selected.id
          ? previous
          : {
              flowId: selected.id,
              revision: selected.publishedRevision!,
              endpoint: selected.publishedEndpoint!,
            },
      )
  }, [
    tenantReview.required,
    currentWebSocket,
    selected?.id,
    selected?.publishedRevision,
  ])

  function tenantLabel(key: Pick<RuntimeKey, 'tenantId'>) {
    if (!key.tenantId) return 'No tenant identity'
    if (member?.role === 'owner')
      return `Original tenant: ${tenantReview.tenants.find((tenant) => tenant.id === key.tenantId)?.label ?? `Tenant ${key.tenantId.slice(0, 8)}`}`
    return key.tenantId === ownTenantContext.context?.tenant?.id
      ? `Original tenant: ${ownTenantContext.context.tenant.label}`
      : 'Original tenant · historical identity'
  }

  function currentSession() {
    const state = useStudio.getState()
    return (
      active.current &&
      state.token === token &&
      state.member?.id === member?.id &&
      can(state.member, 'runtime-keys.manage') &&
      state.sessionId === sessionId
    )
  }

  async function refreshRecords(current: () => boolean) {
    const [records, metadata] = await Promise.allSettled([
      api<RuntimeKey[]>('/api/runtime-keys', token),
      readable ? api<SavedFlow[]>('/api/flows', token) : Promise.resolve(null),
    ])
    if (!current()) return
    setMetadataKnown(false)
    if (records.status === 'fulfilled') {
      setKeys(records.value)
      setCreationUnconfirmed(false)
      setReplacementUnconfirmed(false)
      setDeadlineReviewId(null)
      setIssuedPredecessor(
        records.value.find((key) => key.id === issuedRecord?.replacesKeyId) ??
          null,
      )
      setReplacementOptions((previous) =>
        previous
          ? (records.value.find(
              (key) =>
                key.id === previous.id &&
                !key.revokedAt &&
                !key.replacedByKeyId,
            ) ?? null)
          : null,
      )
    }
    if (
      metadata.status === 'fulfilled' &&
      metadata.value &&
      can(useStudio.getState().member, 'flows.read')
    ) {
      useStudio.setState({ flows: metadata.value })
      setMetadataKnown(true)
      if (selectedAccess) {
        const publishedFlows = metadata.value.filter(
          (flow) => flow.publishedEndpoint,
        )
        const choice =
          publishedFlows.find((flow) => flow.id === flowId) ?? publishedFlows[0]
        if (choice?.publishedRevision && choice.publishedEndpoint)
          setPin(
            (previous) =>
              previous ?? {
                flowId: choice.id,
                revision: choice.publishedRevision!,
                endpoint: choice.publishedEndpoint!,
              },
          )
      }
    }
    if (records.status === 'rejected') throw records.reason
    if (metadata.status === 'rejected')
      throw new Error(
        'API keys loaded, but current API releases could not be read. Refresh to review release status.',
      )
  }

  useEffect(() => {
    if (!can(member, 'runtime-keys.manage')) return

    active.current = true
    let loadingCurrent = true
    setLoading(true)
    setKeys([])
    setIssued('')
    setIssuedRecord(null)
    setIssuedPredecessor(null)
    setReplacementOptions(null)
    setReplacementUnconfirmed(false)
    setDeadlineReviewId(null)
    setReview(null)
    setError('')

    refreshRecords(() => loadingCurrent && currentSession())
      .catch((reason: Error) => {
        if (loadingCurrent && currentSession()) setError(reason.message)
      })
      .finally(() => {
        if (loadingCurrent && currentSession()) setLoading(false)
      })

    return () => {
      active.current = false
      loadingCurrent = false
    }
  }, [token, member?.id, member?.role, member?.permissions, sessionId])

  useEffect(() => {
    if (review && !dialog.current?.open) {
      dialog.current?.showModal()
      cancel.current?.focus()
    }
  }, [review])

  function closeReview() {
    if (useStudio.getState().busy) return
    setReview(null)
    createButton.current?.focus()
  }

  function issue(value: Creation) {
    const {
      apiName: _apiName,
      route: _route,
      tenantLabel: _tenantLabel,
      ...body
    } = value
    perform(async (current) => {
      try {
        const created = await api<RuntimeKey & { token: string }>(
          '/api/runtime-keys',
          token,
          'POST',
          body,
        )
        const { token: secret, ...record } = created
        if (!current()) return
        setIssued(secret)
        setIssuedRecord(record)
        setKeys((records) => [record, ...records])
        setReview(null)
        setName('')
        message('API key created. Save it now; it is shown once.')
      } catch (reason) {
        if (current()) {
          const unconfirmed =
            !(reason instanceof ApiError) || reason.status >= 500
          if (reason instanceof ApiError && reason.status === 409) {
            setMetadataKnown(false)
            setManualReviewNeeded(true)
          }
          if (unconfirmed) {
            setCreationUnconfirmed(true)
            setMetadataKnown(false)
          }
          setReview(null)
          createButton.current?.focus()
          if (unconfirmed)
            throw new Error(
              'Could not confirm whether the API key was created. Refresh API keys to review the current list before trying again. A lost one-time secret cannot be recovered; replace or revoke a created key explicitly.',
            )
        }
        throw reason
      }
    })
  }

  function keyStatus(key: RuntimeKey) {
    if (key.revokedAt) return 'Revoked'
    if (Date.parse(key.expiresAt) <= Date.now()) return 'Expired'
    if (replacementUnconfirmed)
      return 'Replacement status unknown · Refresh required'
    if (key.replacedByKeyId && Date.parse(key.acceptUntil) <= Date.now())
      return 'Replaced · acceptance ended'
    if (key.cleanupOnly) return 'Cleanup only'
    if (key.id === deadlineReviewId) return 'Retiring · deadline not reviewed'
    if (key.replacedByKeyId)
      return 'Retiring · current authority still required'
    const flow =
      readable && metadataKnown
        ? flows.find((flow) => flow.id === key.flowId)
        : null
    if (!flow?.publishedRevision) return 'Current release unknown'
    return key.releaseRevision !== null &&
      key.releaseRevision !== flow.publishedRevision
      ? 'Dormant'
      : key.issuerBinding
        ? 'Current release · linked to member'
        : key.tenantId
          ? 'Current release · original tenant'
          : 'Active'
  }

  function perform(work: (current: () => boolean) => Promise<void>) {
    const current = currentSession

    void task(async () => {
      if (!current()) return
      setError('')

      try {
        await work(current)
      } catch (reason) {
        if (!current()) return
        setError(reason instanceof Error ? reason.message : 'Request failed')
        throw reason
      }
    })
  }

  function replaceKey(key: RuntimeKey, graceSeconds = 0) {
    if (
      locked ||
      replacementUnconfirmed ||
      key.replacedByKeyId ||
      !currentSession() ||
      !Number.isInteger(graceSeconds) ||
      graceSeconds < 0 ||
      graceSeconds > 300
    )
      return
    if (
      !window.confirm(
        `Replace API key ${key.name}? ${graceSeconds ? `The old key continues for up to ${graceSeconds} seconds, ending no later than its original expiry. Besh sets the fixed deadline when replacement is accepted. Both keys still require current authority.` : 'The old key stops working immediately.'} The new key keeps the same API, permissions, ${key.issuerBinding ? 'member link, ' : ''}and expiry. Release access: ${releaseLabel(key)}.${key.issuerBinding ? ` ${issuerLabel(key, member)}.` : ''} Permissions: ${key.permissions.map((permission) => permissionLabels[permission]).join(', ')}. Expires: ${new Date(key.expiresAt).toLocaleString()}.${keyStatus(key) === 'Dormant' ? ' This key remains dormant until its pinned release is current again.' : ''}${key.issuerBinding ? ' The original member must still have its required action, API access and dependency USE.' : ''}${key.tenantId ? ` ${tenantLabel(key)}. Replacement keeps this identity and cannot retarget it after member reassignment.` : ''} Key ID: ${key.id}. API ID: ${key.flowId}. Save the new key and update your caller.`,
      )
    )
      return

    perform(async (current) => {
      let replacement: RuntimeKey & { token: string }
      try {
        replacement = await api<RuntimeKey & { token: string }>(
          `/api/runtime-keys/${key.id}/rotate`,
          token,
          'POST',
          graceSeconds ? { graceSeconds } : undefined,
        )
      } catch (reason) {
        if (current()) setReplacementUnconfirmed(true)
        const detail =
          reason instanceof Error ? reason.message : 'Request failed'
        throw new Error(
          `${detail}. Could not confirm key replacement. Refresh API keys before trying again. If the old key is revoked, create a new API key and update your caller. A lost one-time secret cannot be recovered. Review linked records and explicitly replace or revoke the exact key; do not repeat replacement automatically.`,
        )
      }
      if (!current()) return
      const { token: secret, ...record } = replacement
      setIssued(secret)
      setIssuedRecord(record)
      setIssuedPredecessor(null)
      setDeadlineReviewId(key.id)
      setReplacementOptions(null)
      setKeys((records) => [
        record,
        ...records.map((previous) =>
          previous.id === key.id
            ? {
                ...previous,
                revokedAt: graceSeconds ? null : record.createdAt,
                replacedByKeyId: record.id,
              }
            : previous,
        ),
      ])
      message(
        graceSeconds
          ? 'API key replaced. Save the new key and update your caller during the approved overlap.'
          : 'API key replaced. Update your caller now; the old key no longer works.',
      )
      try {
        const records = await api<RuntimeKey[]>('/api/runtime-keys', token)
        if (!current()) return
        setKeys(records)
        setDeadlineReviewId(null)
        setIssuedPredecessor(
          records.find((previous) => previous.id === key.id) ?? null,
        )
      } catch {
        if (!current()) return
        setReplacementUnconfirmed(true)
        setKeys((records) =>
          records.filter((previous) => previous.id !== key.id),
        )
        throw new Error(
          'Replacement was accepted, but its old-key deadline could not be read. Save the new key now, then Refresh API keys to review current handover metadata. Do not repeat replacement.',
        )
      }
    })
  }

  if (!can(member, 'runtime-keys.manage'))
    return (
      <div className="empty-panel">
        <ShieldCheck />
        <h1>Owner access required</h1>
        <p>Your {member?.role} role does not include API key administration.</p>
      </div>
    )

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">PUBLISHED API ACCESS</div>
          <h1>API keys</h1>
          <p>Give each caller access to one published API, with an expiry.</p>
        </div>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() =>
            perform(async (current) => {
              await refreshRecords(current)
              if (!current()) return
              message('API keys refreshed.')
            })
          }
        >
          <RefreshCw />
          Refresh
        </Button>
      </div>
      <p className="credential-note">
        Owner and member keys manage the workspace. API keys call published
        endpoints and cannot open the dashboard or edit drafts.
      </p>
      {keys.some((key) => key.replacesKeyId || key.replacedByKeyId) ? (
        <p className="credential-note">
          Replacement does not renew expiry. Approved overlaps end at a fixed
          server deadline, while both keys still require current authority.
          Refresh to review current handover records and completed windows.
          Revoking one exact key does not revoke other linked keys.
        </p>
      ) : null}
      {selectedAccess ? (
        <p className="credential-note">
          Selected API keys require a current-release pin and retain their
          original member. Calls work only while that member can manage API keys
          for this API and use its dependencies. Load-test keys require their
          original member's Load testing action. Replacing a key keeps this
          link. Pins do not provide row, column or tenant authorization.
        </p>
      ) : null}
      {!selectedAccess && keys.some((key) => key.issuerBinding) ? (
        <p className="credential-note">
          Member-linked keys work only while the original member has the
          required API key management or Load testing action, API access and
          dependency USE. A current release alone does not prove caller access.
        </p>
      ) : null}
      <p className="credential-note">
        {selectedAccess
          ? 'Selected API keys work only while their pinned release is current.'
          : 'A key can follow published changes or work only while one release is current.'}{' '}
        A release pin does not freeze imported data or product login settings.
        Refresh after publishing or rolling back to review the displayed status.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p>Loading API keys…</p> : null}
      {selected ? (
        <form
          className="runtime-key-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (
              locked ||
              creationUnconfirmed ||
              !metadataKnown ||
              !name.trim() ||
              !permissions.length ||
              !tenantReview.ready ||
              (requiresPin && !selectedPin)
            )
              return

            const value: Creation = {
              name: name.trim(),
              flowId: selected.id,
              permissions,
              expiresAt: new Date(
                Date.now() + Number(days) * 24 * 60 * 60 * 1000,
              ).toISOString(),
              ...(selectedPin ? { releaseRevision: selectedPin.revision } : {}),
              apiName: selected.name,
              route: endpoint
                ? `${websocket ? 'WebSocket' : endpoint.method} ${runtimeEndpointPath(endpoint)}`
                : 'Published endpoint unavailable',
              ...(tenantReview.requestTenantId
                ? { tenantId: tenantReview.requestTenantId }
                : {}),
              ...(tenantReview.required
                ? {
                    tenantLabel: tenantReview.owner
                      ? tenantReview.tenants.find(
                          (tenant) => tenant.id === tenantReview.tenantId,
                        )?.label
                      : tenantReview.context?.tenant?.label,
                  }
                : {}),
            }
            if (selectedPin) setReview(value)
            else issue(value)
          }}
        >
          <div className="runtime-key-fields">
            <label htmlFor="runtime-key-name">
              Key name
              <Input
                id="runtime-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                disabled={locked}
                placeholder="Production caller"
                required
              />
            </label>
            <label htmlFor="runtime-key-api">
              Published API
              <Select
                id="runtime-key-api"
                label="Published API"
                value={selected.id}
                onValueChange={(value) => {
                  setFlowId(value)
                  setScope(null)
                  const choice = published.find((flow) => flow.id === value)
                  setPin(
                    (selectedAccess ||
                      choice?.publishedEndpoint?.transport === 'websocket') &&
                      choice?.publishedRevision &&
                      choice.publishedEndpoint
                      ? {
                          flowId: choice.id,
                          revision: choice.publishedRevision,
                          endpoint: choice.publishedEndpoint,
                        }
                      : null,
                  )
                }}
                disabled={locked}
                options={published.map((flow) => ({
                  value: flow.id,
                  label: flow.name,
                }))}
              />
            </label>
            <label htmlFor="runtime-key-expiry">
              Expires in
              <Select
                id="runtime-key-expiry"
                label="Expires in"
                value={days}
                onValueChange={setDays}
                disabled={locked}
                options={[1, 7, 30, 90].map((value) => ({
                  value: String(value),
                  label: `${value} ${value === 1 ? 'day' : 'days'}`,
                }))}
              />
            </label>
            <label>
              Release access
              <Select
                label="Release access"
                value={selectedPin || requiresPin ? 'pin' : 'follow'}
                disabled={locked || !metadataKnown}
                onValueChange={(value) => {
                  if (
                    value === 'pin' &&
                    selected.publishedRevision &&
                    selected.publishedEndpoint
                  )
                    setPin({
                      flowId: selected.id,
                      revision: selected.publishedRevision,
                      endpoint: selected.publishedEndpoint,
                    })
                  else if (!requiresPin) setPin(null)
                }}
                options={[
                  ...(!requiresPin
                    ? [{ value: 'follow', label: 'Follow published changes' }]
                    : []),
                  { value: 'pin', label: 'Only this release' },
                ]}
              />
            </label>
          </div>
          <TenantReview review={tenantReview} disabled={locked} />
          {currentWebSocket ? (
            <p className="credential-note">
              WebSocket callers require the dedicated WebSocket messages grant
              and a current-release pin. Browser connections use a short-lived
              ticket from the caller’s server; do not put this runtime key in a
              browser URL or local storage.
            </p>
          ) : null}
          {tenantReview.required ? (
            <p className="credential-note">
              Protected callers require the current release pin. The original
              tenant stays unchanged through replacement, publication and
              rollback.
            </p>
          ) : null}
          {selectedPin ? (
            <p className="credential-note">
              Only release {selectedPin.revision} selected. Current published
              release: {metadataKnown ? selected.publishedRevision : 'unknown'}.
              This choice stays unchanged when you refresh.
              {metadataKnown &&
              selectedPin.revision !== selected.publishedRevision ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={locked}
                  onClick={() => {
                    if (
                      selected.publishedRevision &&
                      selected.publishedEndpoint
                    ) {
                      setPin({
                        flowId: selected.id,
                        revision: selected.publishedRevision,
                        endpoint: selected.publishedEndpoint,
                      })
                      setScope(null)
                    }
                  }}
                >
                  Use current release
                </Button>
              ) : null}
            </p>
          ) : (
            <p className="credential-note">
              This key follows future published changes to the selected API.
            </p>
          )}
          {endpoint ? (
            <div className="runtime-endpoint">
              <label htmlFor="runtime-endpoint-url">
                {endpoint.transport === 'websocket'
                  ? 'WebSocket'
                  : endpoint.method}{' '}
                · Published endpoint URL
              </label>
              <Input
                id="runtime-endpoint-url"
                aria-label="Published endpoint URL"
                readOnly
                value={runtimeEndpointUrl(endpoint)}
              />
            </div>
          ) : null}
          <div className="runtime-key-actions">
            <fieldset>
              <legend>Permissions for this API</legend>
              {availablePermissions.map((permission) => (
                <label
                  key={permission}
                  className="permission-choice"
                  htmlFor={`runtime-${permission}`}
                >
                  <Checkbox
                    id={`runtime-${permission}`}
                    checked={permissions.includes(permission)}
                    disabled={locked}
                    onCheckedChange={(checked) =>
                      setScope({
                        flowId: selected.id,
                        permissions:
                          checked === true
                            ? [...permissions, permission]
                            : permissions.filter(
                                (value) => value !== permission,
                              ),
                      })
                    }
                  />
                  {permissionLabels[permission]}
                </label>
              ))}
            </fieldset>
            <Button
              ref={createButton}
              disabled={
                locked ||
                creationUnconfirmed ||
                !name.trim() ||
                !permissions.length ||
                !metadataKnown ||
                !tenantReview.ready ||
                (requiresPin && !selectedPin)
              }
            >
              <Plus />
              Create API key
            </Button>
          </div>
        </form>
      ) : selectedAccess && !readable && member.access.flowIds.length ? (
        <ManualPinnedKeyForm
          flowIds={member.access.flowIds}
          name={name}
          onNameChange={setName}
          disabled={locked || creationUnconfirmed}
          reviewNeeded={manualReviewNeeded}
          onReleaseReviewed={() => setManualReviewNeeded(false)}
          createButton={createButton}
          onReview={(value) => {
            if (
              locked ||
              creationUnconfirmed ||
              !currentSession() ||
              useStudio.getState().busy
            )
              return
            setReview({
              ...value,
              apiName: `API ${value.flowId}`,
              route:
                'Endpoint metadata not read. Besh verifies the supplied current release.',
            })
          }}
        />
      ) : (
        <div className="runtime-key-empty">
          <KeyRound />
          <h2>
            {can(member, 'flows.read')
              ? 'Publish an API first'
              : 'API reading needed for new key choices'}
          </h2>
          <p>
            {can(member, 'flows.read')
              ? 'Save and publish a flow in API Studio, then create a caller key.'
              : 'Your role can manage existing keys below. Ask the owner for Read APIs access to choose a published API when creating a new key.'}
          </p>
        </div>
      )}
      {issued ? (
        <div
          className="issued-token runtime-issued"
          role="region"
          aria-label="Save API key"
        >
          <div>
            <strong>Save this API key</strong>
            <p>Shown once. Copy it before leaving this page.</p>
            {issuedRecord ? (
              <p>
                {issuedRecord.name} · {releaseLabel(issuedRecord)} ·{' '}
                {issuedRecord.permissions
                  .map((permission) => permissionLabels[permission])
                  .join(', ')}
                <br />
                Expires {new Date(issuedRecord.expiresAt).toLocaleString()}
                {issuedRecord.tenantId ? (
                  <>
                    <br />
                    {tenantLabel(issuedRecord)}
                  </>
                ) : null}
                <br />
                {issuedRecord.issuerBinding ? (
                  <>
                    {issuerLabel(issuedRecord, member)}
                    <br />
                  </>
                ) : null}
                {keyStatus(issuedRecord)}
                {keyStatus(issuedRecord) === 'Dormant'
                  ? ' — this key works only if its pinned release becomes current again.'
                  : ''}
              </p>
            ) : null}
            {issuedRecord?.replacesKeyId ? (
              <p className="field-help" style={{ overflowWrap: 'anywhere' }}>
                New key ID: {issuedRecord.id}
                <br />
                Replaces key ID: {issuedRecord.replacesKeyId}
                {issuedPredecessor ? (
                  <>
                    <br />
                    Old key accepted until:{' '}
                    <time dateTime={issuedPredecessor.acceptUntil}>
                      {issuedPredecessor.acceptUntil}
                    </time>
                    <br />
                    {issuedPredecessor.revokedAt
                      ? 'The old key is revoked. Its caller access has ended.'
                      : 'The old key may continue only until this fixed deadline and while current authority permits it. Revoke that exact old key to end acceptance sooner.'}
                  </>
                ) : deadlineReviewId === issuedRecord.replacesKeyId ? (
                  <>
                    <br />
                    Old-key deadline is awaiting current metadata. Save the new
                    key now; Refresh API keys if the deadline cannot be read.
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <Input aria-label="New API key" readOnly value={issued} />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              perform(async (current) => {
                await navigator.clipboard.writeText(issued)
                if (!current()) return

                message('API key copied.')
              })
            }
          >
            <Copy />
            Copy API key
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setIssued('')}>
            I saved this API key
          </Button>
        </div>
      ) : null}
      {replacementOptions ? (
        <KeyReplacementOptions
          key={replacementOptions.id}
          record={replacementOptions}
          disabled={locked || replacementUnconfirmed}
          onCancel={() => setReplacementOptions(null)}
          onReplace={(graceSeconds) =>
            replaceKey(replacementOptions, graceSeconds)
          }
        >
          <p>
            {releaseLabel(replacementOptions)} ·{' '}
            {replacementOptions.permissions
              .map((permission) => permissionLabels[permission])
              .join(', ')}
            <br />
            Original expiry:{' '}
            {new Date(replacementOptions.expiresAt).toLocaleString()}
            <br />
            {issuerLabel(replacementOptions, member)}
            <br />
            {tenantLabel(replacementOptions)}
          </p>
        </KeyReplacementOptions>
      ) : null}
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Key name</th>
              <th>Published API</th>
              <th>Permissions</th>
              <th>Release access</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>
                  <div>{key.name}</div>
                  {key.tenantId ? <small>{tenantLabel(key)}</small> : null}
                  {key.cleanupOnly ? (
                    <p className="field-help">
                      Historical tenant access is unavailable. Revoke this key
                      or ask the owner to review current identity. Replacement
                      cannot retarget it.
                    </p>
                  ) : null}
                  {key.issuerBinding ? (
                    <small>{issuerLabel(key, member)}</small>
                  ) : null}
                  {key.managedBy === 'load-test' ? (
                    <Badge variant="outline">Managed by load testing</Badge>
                  ) : null}
                  {key.replacesKeyId || key.replacedByKeyId ? (
                    <p
                      className="field-help"
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      Key ID: {key.id}
                      <br />
                      {key.replacesKeyId ? (
                        <>
                          Replaces: {key.replacesKeyId}
                          <br />
                        </>
                      ) : null}
                      {key.replacedByKeyId ? (
                        <>
                          Replaced by: {key.replacedByKeyId}
                          <br />
                          {key.id === deadlineReviewId ? (
                            'Old-key deadline is awaiting current metadata.'
                          ) : (
                            <>
                              Accepted until:{' '}
                              <time dateTime={key.acceptUntil}>
                                {key.acceptUntil}
                              </time>
                              <br />
                              This fixed deadline does not bypass current
                              authority. Revoke this exact key to end acceptance
                              sooner.
                            </>
                          )}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </td>
                <td>
                  {(readable
                    ? flows.find((flow) => flow.id === key.flowId)?.name
                    : null) ??
                    (can(member, 'flows.read')
                      ? 'Unavailable API'
                      : `API ${key.flowId.slice(0, 8)}`)}
                </td>
                <td>
                  {key.permissions
                    .map((permission) => permissionLabels[permission])
                    .join(', ')}
                </td>
                <td>{releaseLabel(key)}</td>
                <td>{new Date(key.expiresAt).toLocaleString()}</td>
                <td>
                  <Badge variant="secondary">{keyStatus(key)}</Badge>
                </td>
                <td>
                  {!key.managedBy &&
                  !key.cleanupOnly &&
                  !key.revokedAt &&
                  !key.replacedByKeyId &&
                  Date.parse(key.expiresAt) > Date.now() ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked || replacementUnconfirmed}
                        onClick={() => replaceKey(key)}
                      >
                        <RefreshCw />
                        Replace key
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked || replacementUnconfirmed}
                        onClick={() => setReplacementOptions(key)}
                      >
                        Replacement options
                      </Button>
                    </>
                  ) : null}
                  {!key.revokedAt ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return
                        if (
                          !window.confirm(
                            key.managedBy === 'load-test'
                              ? 'Revoke this temporary load test key? Remaining requests from this run will be rejected.'
                              : `Revoke API key ${key.name}? Existing callers will lose access. Key ID: ${key.id}. API ID: ${key.flowId}.${key.replacesKeyId || key.replacedByKeyId ? ' Only this exact key is revoked. Other linked keys are not revoked.' : ''}`,
                          )
                        )
                          return

                        perform(async (current) => {
                          await api(
                            `/api/runtime-keys/${key.id}`,
                            token,
                            'DELETE',
                          )
                          const records = await api<RuntimeKey[]>(
                            '/api/runtime-keys',
                            token,
                          )
                          if (!current()) return

                          setKeys(records)
                          message('API key revoked.')
                        })
                      }}
                    >
                      <Trash2 />
                      Revoke
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!keys.length && !loading ? (
          <p className="table-empty">No API keys yet.</p>
        ) : null}
      </div>
      {review ? (
        <dialog
          ref={dialog}
          className="rollback-confirm"
          aria-labelledby="pin-key-title"
          onCancel={(event) => {
            event.preventDefault()
            closeReview()
          }}
        >
          <h2 id="pin-key-title">Create release-pinned API key</h2>
          <p>
            {review.name} · {review.apiName}
          </p>
          <p>
            <strong>Only release {review.releaseRevision}</strong>
            <br />
            <code>{review.route}</code>
          </p>
          <p>
            Permissions:{' '}
            {review.permissions
              .map((permission) => permissionLabels[permission])
              .join(', ')}
            <br />
            Expires: {new Date(review.expiresAt).toLocaleString()}
          </p>
          {review.tenantLabel ? (
            <p>
              Original tenant: <strong>{review.tenantLabel}</strong>. This
              identity stays fixed through replacement; current tenant and
              member authority are checked on every protected call.
            </p>
          ) : null}
          {selectedAccess && member ? (
            <p>
              Linked to member {member.name} · API key management. Works only
              while this member can manage keys for this API and use its
              dependencies.
            </p>
          ) : null}
          <p>
            This key becomes dormant if another release is published. It works
            again only when this exact release is current, while the key remains
            unexpired and unrevoked. Imported data and product login settings
            can still change.
          </p>
          <div className="title-actions">
            <Button
              ref={cancel}
              variant="outline"
              disabled={busy}
              onClick={closeReview}
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => issue(review)}>
              Create pinned key
            </Button>
          </div>
        </dialog>
      ) : null}
    </>
  )
}
