import { useState } from 'react'
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Checkbox } from './components/ui/checkbox'
import { api } from './lib/api'
import { useStudio } from './store'

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
          <span className="eyebrow">YOUR IDEAS. CONNECTED.</span>
          <h1>
            Great APIs
            <br />
            start with
            <br />
            <em>a connection.</em>
          </h1>
          <p>
            A visual space to build, test, and publish your next API. From first
            request to final response.
          </p>
          <div className="welcome-diagram">
            <span>
              <Workflow size={21} /> Request
            </span>
            <i />
            <span>
              <Check size={21} /> Response
            </span>
          </div>
        </div>
        <div className="welcome-footer">
          <ShieldCheck size={16} /> Local-first. Built with Bun & Elysia.
        </div>
      </section>
      <section className="welcome-form">
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
                ? 'This key gives owner access. Keep it somewhere safe. Besh stores only its hash.'
                : 'Choose a name. Besh will prepare its local database and create your owner key.'
              : 'Use your owner key or a member token to continue.'}
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
                    <Check /> SQLite database
                  </span>
                  <span>
                    <Check /> Audit & migration logs
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
          <p className="setup-footnote">Besh 0.1 · Local development preview</p>
        </div>
      </section>
    </main>
  )
}
