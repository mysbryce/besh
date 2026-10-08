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
  type RuntimeKey,
  type RuntimePermission,
  type SavedFlow,
} from './lib/api'
import { useStudio } from './store'
import { can } from '../src/workspace/permissions'

const permissionLabels: Record<RuntimePermission, string> = {
  rest: 'REST requests',
  query: 'GraphQL queries',
  mutation: 'GraphQL mutations',
}

function releaseLabel(key: { releaseRevision: number | null }) {
  return key.releaseRevision === null
    ? 'Follow published changes'
    : `Only release ${key.releaseRevision}`
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
  const active = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const readable = can(member, 'flows.read')
  const published = readable
    ? flows.filter((flow) => flow.publishedEndpoint)
    : []
  const selected = published.find((flow) => flow.id === flowId) ?? published[0]
  const selectedPin = pin?.flowId === selected?.id ? pin : null
  const endpoint = selectedPin?.endpoint ?? selected?.publishedEndpoint
  const permissions: RuntimePermission[] =
    scope && scope.flowId === selected?.id
      ? scope.permissions
      : endpoint?.graphql
        ? ['query']
        : ['rest']
  const availablePermissions: RuntimePermission[] = endpoint?.graphql
    ? ['query', 'mutation']
    : ['rest']
  const locked = busy || loading || !!issued

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
    if (records.status === 'fulfilled') setKeys(records.value)
    if (
      metadata.status === 'fulfilled' &&
      metadata.value &&
      can(useStudio.getState().member, 'flows.read')
    ) {
      useStudio.setState({ flows: metadata.value })
      setMetadataKnown(true)
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
    const { apiName: _apiName, route: _route, ...body } = value
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
          if (reason instanceof ApiError && reason.status === 409)
            setMetadataKnown(false)
          setReview(null)
          createButton.current?.focus()
        }
        throw reason
      }
    })
  }

  function keyStatus(key: RuntimeKey) {
    if (key.revokedAt) return 'Revoked'
    if (Date.parse(key.expiresAt) <= Date.now()) return 'Expired'
    const flow =
      readable && metadataKnown
        ? flows.find((flow) => flow.id === key.flowId)
        : null
    if (!flow?.publishedRevision) return 'Current release unknown'
    return key.releaseRevision !== null &&
      key.releaseRevision !== flow.publishedRevision
      ? 'Dormant'
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
      <p className="credential-note">
        A key can follow published changes or work only while one release is
        current. A release pin does not freeze imported data or product login
        settings. Refresh after publishing or rolling back to review the
        displayed status.
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
            if (locked || !metadataKnown || !name.trim() || !permissions.length)
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
              route: `${endpoint?.method} ${endpoint?.graphql ? '/graphql' : '/run'}${endpoint?.path}`,
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
                  setPin(null)
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
                value={selectedPin ? 'pin' : 'follow'}
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
                  else setPin(null)
                }}
                options={[
                  { value: 'follow', label: 'Follow published changes' },
                  { value: 'pin', label: 'Only this release' },
                ]}
              />
            </label>
          </div>
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
                {endpoint.method} · Published endpoint URL
              </label>
              <Input
                id="runtime-endpoint-url"
                aria-label="Published endpoint URL"
                readOnly
                value={
                  new URL(
                    `${endpoint.graphql ? '/graphql' : '/run'}${endpoint.path}`,
                    location.origin,
                  ).href
                }
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
                locked || !name.trim() || !permissions.length || !metadataKnown
              }
            >
              <Plus />
              Create API key
            </Button>
          </div>
        </form>
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
                <br />
                {keyStatus(issuedRecord)}
                {keyStatus(issuedRecord) === 'Dormant'
                  ? ' — this key works only if its pinned release becomes current again.'
                  : ''}
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
                  {key.managedBy === 'load-test' ? (
                    <Badge variant="outline">Managed by load testing</Badge>
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
                  !key.revokedAt &&
                  Date.parse(key.expiresAt) > Date.now() ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return
                        if (
                          !window.confirm(
                            `Replace API key ${key.name}? The old key stops working immediately. The new key keeps the same API, permissions, and expiry. Release access: ${releaseLabel(key)}. Permissions: ${key.permissions.map((permission) => permissionLabels[permission]).join(', ')}. Expires: ${new Date(key.expiresAt).toLocaleString()}.${keyStatus(key) === 'Dormant' ? ' This key remains dormant until its pinned release is current again.' : ''} Save the new key and update your caller.`,
                          )
                        )
                          return

                        perform(async (current) => {
                          let replacement: RuntimeKey & { token: string }

                          try {
                            replacement = await api<
                              RuntimeKey & { token: string }
                            >(
                              `/api/runtime-keys/${key.id}/rotate`,
                              token,
                              'POST',
                            )
                          } catch (reason) {
                            const detail =
                              reason instanceof Error
                                ? reason.message
                                : 'Request failed'

                            throw new Error(
                              `${detail}. Could not confirm key replacement. Refresh API keys before trying again. If the old key is revoked, create a new API key and update your caller.`,
                            )
                          }
                          if (!current()) return
                          const { token: secret, ...record } = replacement

                          setIssued(secret)
                          setIssuedRecord(record)
                          setKeys((records) => [
                            record,
                            ...records.map((previous) =>
                              previous.id === key.id
                                ? { ...previous, revokedAt: record.createdAt }
                                : previous,
                            ),
                          ])
                          message(
                            'API key replaced. Update your caller now; the old key no longer works.',
                          )
                        })
                      }}
                    >
                      <RefreshCw />
                      Replace key
                    </Button>
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
                              : `Revoke API key ${key.name}? Existing callers will lose access.`,
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
