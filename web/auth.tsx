import { useState } from 'react'
import {
  ArrowRight,
  Braces,
  Check,
  Copy,
  KeyRound,
  ShieldCheck,
  GitBranch,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Checkbox } from './components/ui/checkbox'
import { api } from './lib/api'
import { useStudio } from './store'
import { ThemeControl } from './theme'

export function Welcome({
  setup,
  setupKey,
  onSetup,
}: {
  setup: boolean
  setupKey: string
  onSetup: (name: string) => void
}) {
  const [name, setName] = useState('My workspace')
  const [key, setKey] = useState(setupKey)
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [created, setCreated] = useState(false)
  const { task, busy, notice, failed, login, message } = useStudio()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    void task(async () => {
      if (setup && !created) {
        const result = await api<{ token: string; name: string }>(
          '/setup',
          '',
          'POST',
          { name, key },
        )
        setToken(result.token)
        setName(result.name)
        setCreated(true)
        message('Workspace created. Save your owner key.')
      } else {
        await login(token.trim())
        if (setup) onSetup(name)
      }
    })
  }

  return (
    <main className="welcome">
      <section className="welcome-story">
        <a className="brand" href="/" aria-label="Besh home">
          <span className="brand-icon">b</span>besh
          <span className="brand-period">.</span>
        </a>
        <div className="welcome-copy">
          <span className="eyebrow">A SPACE FOR YOUR NEXT IDEA</span>
          <h1>
            Your next API.
            <br />
            <em>Clearly connected.</em>
          </h1>
          <p>
            Turn an idea into an endpoint. Build visually, test your flow, and
            publish when you’re ready.
          </p>
          <div className="welcome-workcards" aria-hidden="true">
            <article className="sample-card sample-rest">
              <div className="sample-card-heading">
                <span className="sample-icon">
                  <ArrowRight size={18} />
                </span>
                <strong>REST API</strong>
                <span className="sample-method">GET</span>
              </div>
              <code>/hello?name=Ada</code>
              <p>Start with a simple request.</p>
            </article>
            <article className="sample-card sample-response">
              <div className="sample-card-heading">
                <span className="sample-icon">
                  <Braces size={18} />
                </span>
                <strong>JSON response</strong>
                <span className="sample-method">200</span>
              </div>
              <pre>{'{\n  "message": "Hello, Ada!"\n}'}</pre>
              <div className="sample-flow">
                <span>Request</span>
                <GitBranch size={16} />
                <span>Response</span>
              </div>
            </article>
            <article className="sample-card sample-graphql">
              <div className="sample-card-heading">
                <span className="sample-icon">
                  <GitBranch size={18} />
                </span>
                <strong>GraphQL API</strong>
              </div>
              <code>{'{ hello { message } }'}</code>
              <p>Ask for exactly what you need.</p>
            </article>
          </div>
        </div>
        <div className="welcome-footer">
          <ShieldCheck size={16} /> Your workspace. Your APIs. Private by
          default.
        </div>
      </section>
      <section className="welcome-form">
        <ThemeControl />
        <div className="setup-card">
          <span className="step-label">
            {setup
              ? created
                ? '02 / SAVE YOUR KEY'
                : '01 / MAKE IT YOURS'
              : 'WELCOME BACK'}
          </span>
          <h2>
            {setup
              ? created
                ? 'Your workspace is ready.'
                : 'A little setup. A lot of possibility.'
              : 'Open your workspace.'}
          </h2>
          <p>
            {setup
              ? created
                ? 'Keep this owner key safe. It is shown once.'
                : 'Choose a name for your workspace. We’ll create an owner key so you can get started.'
              : 'Use your owner key or a member token to manage the workspace. API keys cannot sign in here.'}
          </p>
          <form onSubmit={submit} className="form-stack">
            {setup && !created ? (
              <>
                <label htmlFor="workspace-name">Workspace name</label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                  autoFocus
                />
                {!setupKey ? (
                  <>
                    <label htmlFor="setup-key">Setup key</label>
                    <Input
                      id="setup-key"
                      type="password"
                      value={key}
                      onChange={(event) => setKey(event.target.value)}
                      required
                    />
                    <small>
                      Open the setup link printed in your server terminal.
                    </small>
                  </>
                ) : null}
                <div className="setup-features">
                  <span>
                    <Check /> Visual API Studio
                  </span>
                  <span>
                    <Check /> Separate drafts and releases
                  </span>
                  <span>
                    <Check /> Private workspace
                  </span>
                </div>
              </>
            ) : (
              <>
                <label htmlFor="owner-token">
                  {created ? 'Your owner key' : 'Workspace token'}
                </label>
                <Input
                  id="owner-token"
                  type={created ? 'text' : 'password'}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  readOnly={created}
                  autoComplete="off"
                  required
                  className="font-mono"
                />
                {created ? (
                  <>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() =>
                        void task(async () => {
                          await navigator.clipboard.writeText(token)
                          message('Owner key copied.')
                        })
                      }
                    >
                      <Copy />
                      Copy owner key
                    </Button>
                    <label className="checkbox-row">
                      <Checkbox
                        checked={saved}
                        onCheckedChange={(checked) =>
                          setSaved(checked === true)
                        }
                      />
                      I saved my owner key
                    </label>
                  </>
                ) : (
                  <small>
                    <KeyRound size={13} /> Your token stays in memory until this
                    page closes.
                  </small>
                )}
              </>
            )}
            {failed || created ? (
              <p className={failed ? 'form-error' : 'form-note'} role="status">
                {notice}
              </p>
            ) : null}
            <Button
              type="submit"
              size="lg"
              disabled={busy || (created && !saved)}
            >
              {busy
                ? 'Working…'
                : setup
                  ? created
                    ? 'Enter studio'
                    : 'Create workspace'
                  : 'Open workspace'}
              <ArrowRight />
            </Button>
          </form>
          <p className="setup-footnote">
            A small start. Something worth building.
          </p>
        </div>
      </section>
    </main>
  )
}
