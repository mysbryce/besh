import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Activity,
  Gauge,
  ArrowUpRight,
  Box,
  CircleHelp,
  CloudDownload,
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
import { api, memberRoleName } from './lib/api'
import {
  can,
  permissionCatalog,
  type Permission,
} from '../src/workspace/permissions'
import { ThemeControl } from './theme'
import { LanguageControl } from './language'
import { useTranslation } from './i18n'
import { GitHubIcon } from './components/github-icon'

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
const DatabaseConnections = lazy(() =>
  import('./database-connections').then((module) => ({
    default: module.DatabaseConnections,
  })),
)
const Account = lazy(() =>
  import('./account').then((module) => ({ default: module.Account })),
)
const ProductAuth = lazy(() =>
  import('./product-auth').then((module) => ({ default: module.ProductAuth })),
)
const LoadTests = lazy(() =>
  import('./load-tests').then((module) => ({ default: module.LoadTests })),
)
const Updates = lazy(() =>
  import('./updates').then((module) => ({ default: module.Updates })),
)
const TenantProtection = lazy(() =>
  import('./tenant-protection').then((module) => ({
    default: module.TenantProtection,
  })),
)
const InvitationAccept = lazy(() =>
  import('./invitation-accept').then((module) => ({
    default: module.InvitationAccept,
  })),
)

type Setup = { required: boolean; name: string }
type Page =
  | 'builder'
  | 'data'
  | 'database'
  | 'audit'
  | 'members'
  | 'keys'
  | 'backups'
  | 'roadmap'
  | 'account'
  | 'product-login'
  | 'load-tests'
  | 'updates'
  | 'tenant-protection'

const navigation = [
  { id: 'builder', name: 'API Studio', icon: Workflow },
  { id: 'data', name: 'Data sources', icon: Table2 },
  { id: 'database', name: 'Database connections', icon: Database },
  { id: 'product-login', name: 'Product login', icon: GitHubIcon },
  { id: 'load-tests', name: 'Load testing', icon: Gauge },
  { id: 'audit', name: 'Audit trail', icon: Activity },
  { id: 'members', name: 'Members', icon: Users },
  { id: 'tenant-protection', name: 'Tenant protection', icon: ShieldCheck },
  { id: 'keys', name: 'API keys', icon: KeyRound },
  { id: 'account', name: 'Account & sessions', icon: UserRound },
  { id: 'backups', name: 'Data & backups', icon: Database },
  { id: 'updates', name: 'Updates', icon: CloudDownload },
  { id: 'roadmap', name: 'What’s next', icon: Box },
] as const

export function App({
  invitationToken,
  completeInvitationBootstrap,
}: {
  invitationToken?: string
  completeInvitationBootstrap?: () => string | undefined
}) {
  const { t } = useTranslation()
  const [invitation, setInvitation] = useState<{ token: string | null } | null>(
    () => (invitationToken === undefined ? null : { token: invitationToken }),
  )
  const [invitationSignIn, setInvitationSignIn] = useState(false)
  const [invitationBootstrapReady, setInvitationBootstrapReady] = useState(
    !completeInvitationBootstrap,
  )
  const [invitationEntryError, setInvitationEntryError] = useState('')
  const [setup, setSetup] = useState<Setup | null>(null)
  const [setupError, setSetupError] = useState('')
  const [setupKey] = useState(
    () => new URL(location.href).searchParams.get('setup') ?? '',
  )
  const [page, setPage] = useState<Page>('builder')
  const state = useStudio()

  useEffect(() => {
    setPage(can(state.member, 'flows.read') ? 'builder' : 'account')
  }, [state.sessionId])

  useEffect(() => {
    if (invitation || !invitationBootstrapReady) return
    let active = true
    if (setupKey) history.replaceState(null, '', location.pathname)
    api<Setup>('/setup/status')
      .then((value) => {
        if (!active) return
        setSetup(value)
        if (
          !value.required &&
          !invitationSignIn &&
          !useStudio.getState().authReady
        )
          void useStudio.getState().restoreSession()
      })
      .catch((error: Error) => {
        if (active) setSetupError(error.message)
      })
    return () => {
      active = false
    }
  }, [setupKey, invitation, invitationSignIn, invitationBootstrapReady])

  useEffect(() => {
    const openInvitation = () => {
      const fragment = new URLSearchParams(location.hash.slice(1))
      if (!fragment.has('invite')) return
      const token = fragment.get('invite') ?? ''
      history.replaceState(null, '', `${location.pathname}${location.search}`)
      const current = useStudio.getState()
      if (current.busy || (!invitation && !current.authReady)) {
        const notice =
          'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.'
        setInvitationEntryError(notice)
        current.message(notice, true)
        return
      }
      if (
        current.dirty &&
        !window.confirm(
          'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.',
        )
      )
        return
      setInvitationEntryError('')
      setInvitation({ token })
    }
    window.addEventListener('hashchange', openInvitation)
    // Install the ordinary listener before ending the temporary startup capture.
    const token = completeInvitationBootstrap?.()
    if (token !== undefined) setInvitation({ token })
    setInvitationBootstrapReady(true)
    return () => window.removeEventListener('hashchange', openInvitation)
  }, [invitation, completeInvitationBootstrap])

  useEffect(() => {
    if (!state.dirty && !state.busy) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.dirty, state.busy])

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

  if (invitation)
    return (
      <Suspense
        fallback={
          <main className="loading-screen">
            <p>Opening invitation…</p>
          </main>
        }
      >
        <InvitationAccept
          token={invitation.token}
          entryError={invitationEntryError}
          onConsumed={() => setInvitation({ token: null })}
          onReturn={() => setInvitation(null)}
          onSignedOut={() => {
            useStudio.getState().clearSession()
            useStudio.setState({ authReady: true })
          }}
          onSignIn={() => {
            if (
              useStudio.getState().dirty &&
              !window.confirm('Discard unsaved draft changes and open sign-in?')
            )
              return
            useStudio.getState().clearSession()
            useStudio.setState({ authReady: true })
            setInvitationSignIn(true)
            setInvitation(null)
          }}
        />
      </Suspense>
    )

  if (!setup || (!setup.required && !state.authReady))
    return (
      <main className="loading-screen">
        <span className="brand-icon">b</span>
        <p>{setupError || invitationEntryError || 'Opening your workspace…'}</p>
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

  const pageGrants: Partial<Record<Page, Permission[]>> = {
    builder: ['flows.read'],
    data: ['sources.read', 'sources.write'],
    database: ['database-connections.read', 'database-connections.manage'],
    'product-login': ['auth-connections.read', 'auth-connections.manage'],
    'load-tests': ['load-tests.run'],
    audit: ['audit.read'],
    keys: ['runtime-keys.manage'],
    backups: ['backups.manage', 'migrations.read'],
  }
  const grants = pageGrants[page]
  const selectedAccess = state.member.access.mode === 'selected'
  const selectedPages = ['builder', 'keys', 'load-tests', 'account', 'roadmap']
  const forbidden =
    selectedAccess && !selectedPages.includes(page)
      ? true
      : page === 'members' || page === 'updates' || page === 'tenant-protection'
        ? state.member.role !== 'owner'
        : !!grants &&
          !grants.some((permission) => can(state.member, permission))
  const deniedTitle =
    page === 'members' || page === 'updates' || page === 'tenant-protection'
      ? 'Owner access required'
      : state.member.role === 'custom' ||
          page === 'builder' ||
          page === 'database'
        ? 'Permission required'
        : page === 'data'
          ? 'Editor access required'
          : page === 'product-login'
            ? 'Product login needs editor access'
            : 'Owner access required'

  function switchFlow(action: () => void) {
    if (state.dirty && !window.confirm(t('Discard unsaved draft changes?')))
      return
    action()
    setPage('builder')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          aria-label="Besh home"
          aria-disabled={state.busy}
          tabIndex={state.busy ? -1 : undefined}
          onClick={(event) => {
            if (state.busy) event.preventDefault()
          }}
        >
          <span className="brand-icon">b</span>besh
          <span className="brand-period">.</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            {setup.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{setup.name}</strong>
            <small>{t('Local workspace')}</small>
          </div>
        </div>
        <div className="sidebar-scroll">
          <span className="nav-label">{t('WORKSPACE')}</span>
          <nav aria-label={t('Workspace navigation')}>
            {navigation
              .filter(({ id }) => !selectedAccess || selectedPages.includes(id))
              .filter(
                ({ id }) =>
                  id !== 'tenant-protection' || state.member?.role === 'owner',
              )
              .map(({ id, name, icon: Icon }) => (
                <button
                  key={id}
                  aria-label={t(name)}
                  className={page === id ? 'active' : ''}
                  disabled={state.busy}
                  onClick={() => setPage(id)}
                >
                  <Icon size={18} />
                  {t(name)}
                  {id === 'builder' ? (
                    <span className="nav-count">{state.flows.length}</span>
                  ) : null}
                </button>
              ))}
          </nav>
          <div className="sidebar-api-heading">
            <span className="nav-label">{t('YOUR APIS')}</span>
            <button
              aria-label={t('New API')}
              disabled={
                selectedAccess ||
                !can(state.member, 'flows.read') ||
                !can(state.member, 'flows.write') ||
                state.busy
              }
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
                  <small>
                    {flow.websocket ? 'WS' : flow.graphql ? 'GQL' : flow.method}
                  </small>
                </button>
              ))
            ) : (
              <p>
                {selectedAccess ? (
                  state.member.access.flowIds.length &&
                  !can(state.member, 'flows.read') ? (
                    'API reading is not granted. Use your permitted API actions, or ask the owner to review your role.'
                  ) : (
                    'No APIs shared. Ask the owner to review your API access.'
                  )
                ) : (
                  <>
                    {t('Your next idea starts here.')}
                    <br />
                    {t('Create your first API.')}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <GitBranch size={17} />
            <strong>{t('Small steps. Powerful APIs.')}</strong>
            <p>{t('Build a flow you can understand, test, and trust.')}</p>
          </div>
          <button
            className="user-profile"
            aria-label={t('Sign out')}
            onClick={() => {
              if (
                state.dirty &&
                !window.confirm(t('Discard unsaved draft changes?'))
              )
                return
              void state.task(state.logout)
            }}
            disabled={state.busy}
          >
            <span className="user-avatar">{state.member.name.slice(0, 1)}</span>
            <span>
              <strong>{state.member.name}</strong>
              <small>
                {state.member.role === 'custom'
                  ? memberRoleName(state.member)
                  : t(memberRoleName(state.member))}
              </small>
            </span>
            <LogOut size={16} />
            <span className="sr-only">{t('Sign out')}</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <LayoutGrid size={16} />
            <span>{t('Workspace')}</span>
            <span>/</span>
            <strong>
              {t(navigation.find((item) => item.id === page)?.name ?? '')}
            </strong>
          </div>
          <div>
            <LanguageControl disabled={state.busy} />
            <ThemeControl />
            <Badge variant="outline">
              <span className="live-dot" />
              {t('Local workspace')}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('Help & roadmap')}
              disabled={state.busy}
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
          <Suspense fallback={<p>{t('Opening studio…')}</p>}>
            {forbidden ? (
              <div className="empty-panel">
                <ShieldCheck />
                <h1>{t(deniedTitle)}</h1>
                <p>
                  {page === 'members'
                    ? t('Only the owner can manage members and roles.')
                    : page === 'updates'
                      ? t(
                          'Only the owner can manage Besh release settings and update notices.',
                        )
                      : page === 'tenant-protection'
                        ? 'Only the owner can approve tenant identities and row protection.'
                        : page === 'load-tests' &&
                            state.member.role !== 'custom'
                          ? `Your ${state.member.role} role cannot run or view workspace load tests. Ask an owner to test the published API.`
                          : `Your ${memberRoleName(state.member)} role needs ${grants?.map((permission) => permissionCatalog.find((entry) => entry.id === permission)?.label).join(' or ')} access. Ask the workspace owner to review your grants.`}
                </p>
              </div>
            ) : page === 'builder' ? (
              state.member.flowAccess.mode === 'selected' &&
              !state.flows.length ? (
                <div className="empty-panel">
                  <ShieldCheck />
                  <h1>{t('No APIs shared')}</h1>
                  <p>
                    Ask the workspace owner to review your selected API access.
                    You can still manage your own account and sessions.
                  </p>
                </div>
              ) : (
                <Builder onOpenData={() => setPage('data')} />
              )
            ) : page === 'data' ? (
              <DataSources onOpenApi={() => setPage('builder')} />
            ) : page === 'database' ? (
              <DatabaseConnections onOpenApi={() => setPage('builder')} />
            ) : page === 'product-login' ? (
              <ProductAuth onOpenApi={() => setPage('builder')} />
            ) : page === 'load-tests' ? (
              <LoadTests />
            ) : page === 'roadmap' ? (
              <Roadmap />
            ) : page === 'keys' ? (
              <RuntimeKeys />
            ) : page === 'account' ? (
              <Account />
            ) : page === 'updates' ? (
              <Updates />
            ) : page === 'tenant-protection' ? (
              <TenantProtection />
            ) : (
              <Operations key={page} page={page} />
            )}
          </Suspense>
        </main>
        <footer className={`statusbar ${state.failed ? 'error' : ''}`}>
          <span role="status">{t(state.busy ? 'Working…' : state.notice)}</span>
          <span>
            <ShieldCheck size={13} />
            {t('Drafts stay separate from published APIs')}
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
      'More product login providers, product sessions, and realtime broadcasts.',
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
