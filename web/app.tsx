import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Box,
  ChevronDown,
  CircleHelp,
  Database,
  GitBranch,
  LayoutGrid,
  LogOut,
  Plus,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react'
import { Welcome } from './auth'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { useStudio } from './store'
import { api } from './lib/api'

const Builder = lazy(() =>
  import('./builder').then((module) => ({ default: module.Builder })),
)
const Operations = lazy(() =>
  import('./operations').then((module) => ({ default: module.Operations })),
)

type Setup = { required: boolean; name: string }
type Page = 'builder' | 'audit' | 'members' | 'backups' | 'roadmap'

const navigation = [
  { id: 'builder', name: 'API Studio', icon: Workflow },
  { id: 'audit', name: 'Audit trail', icon: Activity },
  { id: 'members', name: 'Members', icon: Users },
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
    let active = true
    if (setupKey) history.replaceState(null, '', location.pathname)
    api<Setup>('/setup/status')
      .then((value) => {
        if (active) setSetup(value)
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

  if (!setup)
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
          <ChevronDown size={15} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {navigation.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
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
                <small>{flow.method}</small>
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
            onClick={() => switchFlow(state.logout)}
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
            <Badge variant="outline">
              <span className="live-dot" />
              Local
            </Badge>
            <a
              href="https://github.com/elysiajs/elysia"
              target="_blank"
              rel="noreferrer"
              aria-label="About Elysia"
            >
              <CircleHelp size={18} />
            </a>
          </div>
        </header>
        <main className="main-content">
          <Suspense fallback={<p>Opening studio…</p>}>
            {page === 'builder' ? (
              <Builder />
            ) : page === 'roadmap' ? (
              <Roadmap />
            ) : (
              <Operations key={page} page={page} />
            )}
          </Suspense>
        </main>
        <footer className={`statusbar ${state.failed ? 'error' : ''}`}>
          <span role="status">{state.busy ? 'Working…' : state.notice}</span>
          <span>
            <ShieldCheck size={13} />
            Besh 0.1 · Development preview
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
      'Social sign-in, custom permissions, OpenAPI, API keys, and WebSocket flows.',
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
        Full scope and completion gates live in <code>docs/roadmap.md</code>.
      </p>
    </>
  )
}
