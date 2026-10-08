import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Box,
  CircleHelp,
  Database,
  GitBranch,
  LayoutGrid,
  KeyRound,
  LogOut,
  Plus,
  ShieldCheck,
  Table2,
  Users,
  UserRound,
  Workflow,
} from 'lucide-react'
import { Welcome } from './auth'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { useStudio } from './store'
import { api } from './lib/api'
import { ThemeControl } from './theme'

const Builder = lazy(() =>
  import('./builder').then((module) => ({ default: module.Builder })),
)
const Operations = lazy(() =>
  import('./operations').then((module) => ({ default: module.Operations })),
)
const RuntimeKeys = lazy(() =>
  import('./runtime-keys').then((module) => ({ default: module.RuntimeKeys })),
)
const FlowPicker = lazy(() =>
  import('./flow-picker').then((module) => ({ default: module.FlowPicker })),
)
const DataSources = lazy(() =>
  import('./data-sources').then((module) => ({ default: module.DataSources })),
)
const Account = lazy(() =>
  import('./account').then((module) => ({ default: module.Account })),
)

type Setup = { required: boolean; name: string }
type Page =
  | 'builder'
  | 'data'
  | 'audit'
  | 'members'
  | 'keys'
  | 'backups'
  | 'roadmap'
  | 'account'

const navigation = [
  { id: 'builder', name: 'API Studio', icon: Workflow },
  { id: 'data', name: 'Data sources', icon: Table2 },
  { id: 'audit', name: 'Audit trail', icon: Activity },
  { id: 'members', name: 'Members', icon: Users },
  { id: 'keys', name: 'API keys', icon: KeyRound },
  { id: 'account', name: 'Account & sessions', icon: UserRound },
  { id: 'backups', name: 'Data & backups', icon: Database },
  { id: 'roadmap', name: 'What’s next', icon: Box },
] as const

export function App() {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [setupError, setSetupError] = useState('')
  const [setupKey] = useState(
    () => new URL(location.href).searchParams.get('setup') ?? '',
  )
  const [page, setPage] = useState<Page>('builder')
  const state = useStudio()

  useEffect(() => {
    setPage('builder')
  }, [state.sessionId])

  useEffect(() => {
    let active = true
    if (setupKey) history.replaceState(null, '', location.pathname)
    api<Setup>('/setup/status')
      .then((value) => {
        if (active) setSetup(value)
        if (!value.required) void useStudio.getState().restoreSession()
      })
      .catch((error: Error) => {
        if (active) setSetupError(error.message)
      })
    return () => {
      active = false
    }
  }, [setupKey])

  useEffect(() => {
    if (!state.dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.dirty])

  useEffect(() => {
    if (!state.expiresAt) return
    const remaining = Date.parse(state.expiresAt) - Date.now()
    const timer = window.setTimeout(
      () => {
        useStudio
          .getState()
          .clearSession('Your session expired. Sign in again.')
      },
      Math.max(0, remaining),
    )
    return () => window.clearTimeout(timer)
  }, [state.expiresAt])

  if (!setup || (!setup.required && !state.authReady))
    return (
      <main className="loading-screen">
        <span className="brand-icon">b</span>
        <p>{setupError || 'Opening your workspace…'}</p>
        {setupError ? (
          <Button onClick={() => location.reload()}>Try again</Button>
        ) : null}
      </main>
    )
  if (setup.required || !state.member)
    return (
      <Welcome
        setup={setup.required}
        setupKey={setupKey}
        onSetup={(name) => setSetup({ required: false, name })}
      />
    )

  function switchFlow(action: () => void) {
    if (state.dirty && !window.confirm('Discard unsaved draft changes?')) return
    action()
    setPage('builder')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Besh home">
          <span className="brand-icon">b</span>besh
          <span className="brand-period">.</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            {setup.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{setup.name}</strong>
            <small>Local workspace</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {navigation.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              aria-label={name}
              className={page === id ? 'active' : ''}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              {name}
              {id === 'builder' ? (
                <span className="nav-count">{state.flows.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-api-heading">
          <span className="nav-label">YOUR APIS</span>
          <button
            aria-label="New API"
            disabled={state.member.role === 'viewer' || state.busy}
            onClick={() => switchFlow(state.fresh)}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="api-list">
          {state.flows.length ? (
            state.flows.map((flow) => (
              <button
                key={flow.id}
                disabled={state.busy}
                className={state.id === flow.id ? 'selected' : ''}
                onClick={() => switchFlow(() => state.load(flow))}
              >
                <span className="api-dot" />
                <span>{flow.name}</span>
                <small>{flow.graphql ? 'GQL' : flow.method}</small>
              </button>
            ))
          ) : (
            <p>
              Your next idea starts here.
              <br />
              Create your first API.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <GitBranch size={17} />
            <strong>Small steps. Powerful APIs.</strong>
            <p>Build a flow you can understand, test, and trust.</p>
          </div>
          <button
            className="user-profile"
            aria-label="Sign out"
            onClick={() => {
              if (
                state.dirty &&
                !window.confirm('Discard unsaved draft changes?')
              )
                return
              void state.task(state.logout)
            }}
            disabled={state.busy}
          >
            <span className="user-avatar">{state.member.name.slice(0, 1)}</span>
            <span>
              <strong>{state.member.name}</strong>
              <small>{state.member.role}</small>
            </span>
            <LogOut size={16} />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <LayoutGrid size={16} />
            <span>Workspace</span>
            <span>/</span>
            <strong>{navigation.find((item) => item.id === page)?.name}</strong>
          </div>
          <div>
            <ThemeControl />
            <Badge variant="outline">
              <span className="live-dot" />
              Local workspace
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Help & roadmap"
              onClick={() => setPage('roadmap')}
            >
              <CircleHelp size={18} />
            </Button>
          </div>
        </header>
        {state.flows.length ? (
          <Suspense fallback={null}>
            <FlowPicker
              flows={state.flows}
              selected={state.id}
              disabled={state.busy}
              onSelect={(id) => {
                const flow = state.flows.find((item) => item.id === id)
                if (flow) switchFlow(() => state.load(flow))
              }}
            />
          </Suspense>
        ) : null}
        <main className="main-content">
          <Suspense fallback={<p>Opening studio…</p>}>
            {page === 'builder' ? (
              <Builder />
            ) : page === 'data' ? (
              <DataSources onOpenApi={() => setPage('builder')} />
            ) : page === 'roadmap' ? (
              <Roadmap />
            ) : page === 'keys' ? (
              <RuntimeKeys />
            ) : page === 'account' ? (
              <Account />
            ) : (
              <Operations key={page} page={page} />
            )}
          </Suspense>
        </main>
        <footer className={`statusbar ${state.failed ? 'error' : ''}`}>
          <span role="status">{state.busy ? 'Working…' : state.notice}</span>
          <span>
            <ShieldCheck size={13} />
            Drafts stay separate from published APIs
          </span>
        </footer>
      </div>
    </div>
  )
}

function Roadmap() {
  const items = [
    [
      'Identity & contracts',
      'Social sign-in templates for the APIs you create, custom permissions, and WebSocket flows.',
    ],
    [
      'Connect your data',
      'PostgreSQL, MySQL/MariaDB, MongoDB, Supabase, and Firebase adapters.',
    ],
    [
      'Make it your own',
      'Plugin SDK, manifest upload, and isolated custom code execution.',
    ],
    [
      'Build with an agent',
      'Claude, OpenAI, OpenRouter, Ollama-compatible APIs, and a Codex CLI adapter.',
    ],
  ]
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">A FOUNDATION TO GROW WITH</div>
          <h1>
            What’s next <Badge variant="outline">Planned</Badge>
          </h1>
          <p>
            Working core today. More possibilities, one tested step at a time.
          </p>
        </div>
      </div>
      <div className="roadmap-grid">
        {items.map(([name, description], index) => (
          <article className="roadmap-card" key={name}>
            <span className="roadmap-number">0{index + 2}</span>
            <ArrowUpRight />
            <h2>{name}</h2>
            <p>{description}</p>
            <Badge variant="secondary">Not available yet</Badge>
          </article>
        ))}
      </div>
      <p className="roadmap-footer">
        A working foundation, with room for your next idea. These capabilities
        are planned and are not enabled yet.
      </p>
    </>
  )
}
