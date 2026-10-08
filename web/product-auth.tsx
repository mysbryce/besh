import { useEffect, useState } from 'react'
import { ShieldCheck, ArrowUpRight } from 'lucide-react'
import { GitHubIcon } from './components/github-icon'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { api, type AuthConnection, type SavedFlow } from './lib/api'
import { useStudio } from './store'

type ConnectionValues = {
  name: string
  clientId: string
  clientSecret?: string
  redirectUri: string
}

function ConnectionForm({
  connection,
  busy,
  onSave,
  onCancel,
}: {
  connection: AuthConnection | null
  busy: boolean
  onSave: (values: ConnectionValues) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(connection?.name ?? '')
  const [clientId, setClientId] = useState(connection?.clientId ?? '')
  const [secret, setSecret] = useState('')
  const [callback, setCallback] = useState(connection?.redirectUri ?? '')
  const [error, setError] = useState('')

  return (
    <section className="source-preview product-connection-form">
      <h2>{connection ? 'Edit GitHub connection' : 'Connect GitHub'}</h2>
      <p className="field-help">
        Register a GitHub OAuth app for your product. Copy its client ID and
        secret here. Its authorization callback URL must match your product
        server callback.
      </p>
      <a
        className="product-registration"
        href="https://github.com/settings/applications/new"
        target="_blank"
        rel="noreferrer"
      >
        Register a GitHub OAuth app <ArrowUpRight size={14} />
      </a>
      <form
        className="simple-form"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          try {
            await onSave({
              name: name.trim(),
              clientId: clientId.trim(),
              redirectUri: callback.trim(),
              ...(secret ? { clientSecret: secret } : {}),
            })
            setSecret('')
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : 'Could not save connection.',
            )
          }
        }}
      >
        <label htmlFor="product-connection-name">
          Connection name
          <Input
            id="product-connection-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            disabled={busy}
          />
        </label>
        <label htmlFor="product-client-id">
          GitHub client ID
          <Input
            id="product-client-id"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            required
            maxLength={200}
            disabled={busy}
          />
        </label>
        <label htmlFor="product-client-secret">
          GitHub client secret
          <Input
            id="product-client-secret"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            required={!connection}
            disabled={busy}
            aria-describedby="product-secret-help"
          />
        </label>
        <p className="field-help" id="product-secret-help">
          {connection
            ? 'Leave blank to keep the saved secret. Secrets cannot be read back.'
            : 'Stored securely on the Besh server. Never returned with connection details.'}
        </p>
        <label htmlFor="product-callback">
          Callback URL
          <Input
            id="product-callback"
            type="url"
            value={callback}
            onChange={(event) => setCallback(event.target.value)}
            placeholder="https://your-product.example/login/callback"
            required
            disabled={busy}
            aria-describedby="product-callback-help"
          />
        </label>
        <p className="field-help" id="product-callback-help">
          Your product server receives GitHub’s callback here. Use HTTPS, or
          HTTP on localhost for development.
        </p>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button disabled={busy}>Save connection</Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}

function LoginTemplateForm({
  connection,
  busy,
  onCreate,
  onCancel,
}: {
  connection: AuthConnection
  busy: boolean
  onCreate: (values: {
    name: string
    path: string
    kind: 'rest' | 'graphql'
  }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(`${connection.name} login`.slice(0, 80))
  const [path, setPath] = useState('/login/github')
  const [kind, setKind] = useState<'rest' | 'graphql'>('rest')
  const [error, setError] = useState('')

  return (
    <section className="source-preview product-connection-form">
      <h2>Create login API</h2>
      <p className="field-help">
        A normal draft with request, GitHub login, and response steps. Review
        and test before publishing.
      </p>
      <form
        className="simple-form"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          try {
            await onCreate({ name: name.trim(), path, kind })
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : 'Could not create draft.',
            )
          }
        }}
      >
        <label htmlFor="login-api-name">
          API name
          <Input
            id="login-api-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            disabled={busy}
          />
        </label>
        <label htmlFor="login-api-kind">
          API type
          <Select
            id="login-api-kind"
            label="API type"
            value={kind}
            onValueChange={(value) => setKind(value as 'rest' | 'graphql')}
            options={[
              { value: 'rest', label: 'REST' },
              { value: 'graphql', label: 'GraphQL' },
            ]}
            disabled={busy}
          />
        </label>
        <label htmlFor="login-api-path">
          Endpoint path
          <Input
            id="login-api-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            required
            maxLength={160}
            disabled={busy}
          />
        </label>
        <p className="field-help">
          POST {kind === 'rest' ? '/run' : '/graphql'}
          {path} after publication. BEGIN starts login; COMPLETE receives the
          callback.
        </p>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button disabled={busy}>Create draft</Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}

export function ProductAuth({ onOpenApi }: { onOpenApi: () => void }) {
  const state = useStudio()
  const [connections, setConnections] = useState<AuthConnection[]>([])
  const [editing, setEditing] = useState<AuthConnection | null | undefined>()
  const [generating, setGenerating] = useState<AuthConnection | null>(null)
  const [pending, setBusy] = useState(false)
  const busy = pending || state.busy
  const [error, setError] = useState('')
  const viewer = state.member?.role === 'viewer'
  const owner = state.member?.role === 'owner'

  useEffect(() => {
    if (viewer) return
    let active = true
    api<AuthConnection[]>('/api/auth-connections', state.token)
      .then((value) => {
        if (active) setConnections(value)
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message)
      })
    return () => {
      active = false
    }
  }, [state.token, viewer])

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">IDENTITY FOR YOUR PRODUCT</div>
          <h1>
            GitHub product login <Badge variant="outline">API template</Badge>
          </h1>
          <p>Create login APIs for people using your product.</p>
        </div>
        {owner ? (
          <Button
            disabled={busy || editing !== undefined}
            onClick={() => setEditing(null)}
          >
            <GitHubIcon />
            Connect GitHub
          </Button>
        ) : null}
      </div>
      {viewer ? (
        <section className="source-preview">
          <h2>Product login needs editor access</h2>
          <p>
            Ask an owner or editor to review product login connections and
            templates.
          </p>
        </section>
      ) : (
        <>
          <section className="product-login-guide">
            <ShieldCheck size={20} />
            <div>
              <strong>Your product server handles the login</strong>
              <p>
                Call your published login API from your product server with a
                runtime API key. Keep the returned proof on that server, then
                send the authorization URL to your user. Your callback forwards
                code, state, and proof to complete login.
              </p>
              <p>
                Associate each attempt with the initiating browser on your
                product server. Check callback state matches that attempt before
                completing login.
              </p>
              <p>
                The result is a GitHub identity. Your product decides account
                linking, access, and sessions.
              </p>
            </div>
          </section>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          {generating ? (
            <LoginTemplateForm
              connection={generating}
              busy={busy}
              onCancel={() => setGenerating(null)}
              onCreate={async (values) => {
                if (busy) return
                if (state.dirty && !confirm('Discard unsaved draft changes?'))
                  return
                let failure: unknown
                await state.task(async () => {
                  try {
                    const flow = await api<SavedFlow>(
                      `/api/auth-connections/${generating.id}/generate`,
                      state.token,
                      'POST',
                      values,
                    )
                    state.openCreated(flow)
                    state.message(
                      'Login API draft created. Test it, then publish when ready.',
                    )
                    onOpenApi()
                  } catch (error) {
                    failure = error
                    throw error
                  }
                })
                if (failure) throw failure
              }}
            />
          ) : null}
          {editing !== undefined ? (
            <ConnectionForm
              connection={editing}
              busy={busy}
              onCancel={() => setEditing(undefined)}
              onSave={async (values) => {
                setBusy(true)
                try {
                  const connection = await api<AuthConnection>(
                    editing
                      ? `/api/auth-connections/${editing.id}`
                      : '/api/auth-connections',
                    state.token,
                    editing ? 'PUT' : 'POST',
                    { ...values, ...(!editing ? { provider: 'github' } : {}) },
                  )
                  setConnections((current) => [
                    connection,
                    ...current.filter((item) => item.id !== connection.id),
                  ])
                  setEditing(undefined)
                  state.message(
                    'GitHub connection saved. Create a login API when ready.',
                  )
                } finally {
                  setBusy(false)
                }
              }}
            />
          ) : null}
          <div className="product-connection-grid">
            {connections.map((connection) => (
              <article
                className="source-preview product-connection"
                key={connection.id}
              >
                <div className="product-provider-heading">
                  <span className="product-provider-icon">
                    <GitHubIcon size={24} />
                  </span>
                  <div>
                    <h2>{connection.name}</h2>
                    <Badge variant="secondary">
                      GitHub · version {connection.version}
                    </Badge>
                  </div>
                </div>
                <dl>
                  <dt>Client ID</dt>
                  <dd>{connection.clientId}</dd>
                  <dt>Callback URL</dt>
                  <dd>{connection.redirectUri}</dd>
                </dl>
                <div className="source-actions">
                  <Button
                    disabled={busy || editing !== undefined || !!generating}
                    onClick={() => setGenerating(connection)}
                  >
                    Create login API
                  </Button>
                </div>
                {owner ? (
                  <div className="source-actions">
                    <Button
                      variant="outline"
                      disabled={busy || editing !== undefined}
                      onClick={() => setEditing(connection)}
                    >
                      Edit connection
                    </Button>
                    <Button
                      variant="ghost"
                      className="source-delete"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          !confirm(
                            `Delete ${connection.name}? This cannot be undone. Referenced connections cannot be deleted.`,
                          )
                        )
                          return
                        setBusy(true)
                        setError('')
                        try {
                          await api(
                            `/api/auth-connections/${connection.id}`,
                            state.token,
                            'DELETE',
                          )
                          setConnections((current) =>
                            current.filter((item) => item.id !== connection.id),
                          )
                          state.message('GitHub connection deleted.')
                        } catch (failure) {
                          setError(
                            failure instanceof Error
                              ? failure.message
                              : 'Could not delete connection.',
                          )
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      Delete connection
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {!connections.length && editing === undefined && !error ? (
            <section className="source-preview">
              <h2>Start with your GitHub app</h2>
              <p className="field-help">
                {owner
                  ? 'Connect your product’s OAuth app, then create a REST or GraphQL draft.'
                  : 'An owner can connect a GitHub OAuth app. You can create drafts from connected apps.'}
              </p>
            </section>
          ) : null}
        </>
      )}
    </>
  )
}
