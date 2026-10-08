import { useEffect, useState } from 'react'
import {
  Copy,
  Download,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Badge } from './components/ui/badge'
import {
  api,
  authenticatedFetch,
  type AuditEvent,
  type Backup,
  type Member,
  type Role,
  memberRoleName,
  type Migration,
} from './lib/api'
import { useStudio } from './store'
import { can } from '../src/workspace/permissions'
import { Roles, MemberAssignment, roleChoice, roleOptions } from './roles'

export function Operations({
  page,
}: {
  page: 'audit' | 'members' | 'backups'
}) {
  const { token, member, task, busy, message } = useStudio()
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [backups, setBackups] = useState<Backup[]>([])
  const [migrations, setMigrations] = useState<Migration[]>([])
  const [name, setName] = useState('')
  const [role, setRole] = useState('viewer')
  const [roles, setRoles] = useState<Role[]>([])
  const [issued, setIssued] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const backupAllowed = can(member, 'backups.manage')
  const migrationsAllowed = can(member, 'migrations.read')
  const allowed =
    page === 'members'
      ? member?.role === 'owner'
      : page === 'audit'
        ? can(member, 'audit.read')
        : backupAllowed || migrationsAllowed

  useEffect(() => {
    if (
      role !== 'viewer' &&
      role !== 'editor' &&
      !roles.some((item) => item.id === role)
    )
      setRole('viewer')
  }, [role, roles])

  async function refresh() {
    if (page === 'audit') setAudit(await api<AuditEvent[]>('/api/audit', token))
    if (page === 'members') {
      const [people, custom] = await Promise.all([
        api<Member[]>('/api/members', token),
        api<Role[]>('/api/roles', token),
      ])
      setMembers(people)
      setRoles(custom)
    }
    if (page === 'backups') {
      const [copies, history] = await Promise.all([
        backupAllowed
          ? api<Backup[]>('/api/backups', token)
          : Promise.resolve([]),
        migrationsAllowed
          ? api<Migration[]>('/api/migrations', token)
          : Promise.resolve([]),
      ])
      setBackups(copies)
      setMigrations(history)
    }
    setError('')
  }

  useEffect(() => {
    if (!allowed) {
      setLoading(false)
      return
    }
    let active = true
    const routes =
      page === 'audit'
        ? ['/api/audit']
        : page === 'members'
          ? ['/api/members', '/api/roles']
          : [
              ...(backupAllowed ? ['/api/backups'] : []),
              ...(migrationsAllowed ? ['/api/migrations'] : []),
            ]
    Promise.all(routes.map((route) => api<unknown>(route, token)))
      .then((data) => {
        if (!active) return
        if (page === 'audit') setAudit(data[0] as AuditEvent[])
        if (page === 'members') {
          setMembers(data[0] as Member[])
          setRoles(data[1] as Role[])
        }
        if (page === 'backups') {
          setBackups(backupAllowed ? (data[0] as Backup[]) : [])
          setMigrations(
            migrationsAllowed
              ? (data[backupAllowed ? 1 : 0] as Migration[])
              : [],
          )
        }
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
  }, [
    page,
    token,
    member?.id,
    member?.permissions,
    allowed,
    backupAllowed,
    migrationsAllowed,
  ])

  const title =
    page === 'audit'
      ? 'Audit trail'
      : page === 'members'
        ? 'Your team'
        : 'Data & backups'

  if (!allowed)
    return (
      <div className="empty-panel">
        <ShieldCheck />
        <h1>Owner access required</h1>
        <p>
          Your {member?.role} role does not include workspace administration.
        </p>
      </div>
    )

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">WORKSPACE CONTROL</div>
          <h1>{title}</h1>
          <p>
            {page === 'audit'
              ? 'A record of changes, runs, and access decisions. Latest 200 events.'
              : page === 'members'
                ? 'Member keys manage the workspace. Use API keys for published endpoint callers.'
                : 'Keep a consistent copy of your workspace. Restore offline.'}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void task(refresh)}
        >
          <RefreshCw />
          Refresh
        </Button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p>Loading workspace records…</p> : null}
      {page === 'members' ? (
        <>
          <Roles roles={roles} onChanged={refresh} />
          <form
            className="member-form"
            onSubmit={(event) => {
              event.preventDefault()
              void task(async () => {
                const created = await api<Member & { token: string }>(
                  '/api/members',
                  token,
                  'POST',
                  {
                    name,
                    ...roleChoice(role),
                    ...(email.trim() ? { email: email.trim(), password } : {}),
                  },
                )
                setIssued(created.token)
                setName('')
                setEmail('')
                setPassword('')
                await refresh()
                message('Member created. Save their token; it is shown once.')
              })
            }}
          >
            <label>
              Name
              <Input
                aria-label="Member name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                disabled={busy || !!issued}
                required
              />
            </label>
            <label>
              Role
              <Select
                label="Member role"
                value={role}
                disabled={busy || !!issued}
                onValueChange={setRole}
                options={roleOptions(roles)}
              />
            </label>
            <label>
              Member email (optional)
              <Input
                aria-label="Member email (optional)"
                type="email"
                autoComplete="off"
                maxLength={254}
                value={email}
                disabled={busy || !!issued}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (!event.target.value) setPassword('')
                }}
              />
            </label>
            <label>
              Member password
              <Input
                aria-label="Member password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={password}
                required={!!email.trim()}
                disabled={busy || !!issued || !email.trim()}
                onChange={(event) => setPassword(event.target.value)}
              />
              <small>
                12 to 128 characters. Leave email blank for key-only access.
              </small>
            </label>
            <Button disabled={busy || !!issued}>
              <Plus />
              Add member
            </Button>
          </form>
          {issued ? (
            <div className="issued-token">
              <strong>Save this member token</strong>
              <Input aria-label="New member token" readOnly value={issued} />
              <Button
                variant="outline"
                onClick={() =>
                  void task(async () => {
                    await navigator.clipboard.writeText(issued)
                    message('Member token copied.')
                  })
                }
              >
                <Copy />
                Copy
              </Button>
              <Button variant="ghost" onClick={() => setIssued('')}>
                I saved it
              </Button>
            </div>
          ) : null}
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {members.map((person) => (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    <td>
                      <Badge variant="secondary">
                        {memberRoleName(person)}
                      </Badge>
                      {person.role !== 'owner' ? (
                        <MemberAssignment
                          member={person}
                          roles={roles}
                          onChanged={refresh}
                        />
                      ) : null}
                    </td>
                    <td>
                      {person.role === 'owner' ? (
                        'Bootstrap owner'
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Revoke access for ${person.name}?`,
                              )
                            )
                              void task(async () => {
                                await api(
                                  `/api/members/${person.id}`,
                                  token,
                                  'DELETE',
                                )
                                await refresh()
                                message('Member access revoked.')
                              })
                          }}
                        >
                          <Trash2 />
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {page === 'audit' ? (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((event) => (
                <tr key={event.id}>
                  <td>
                    <code>{event.action}</code>
                  </td>
                  <td>
                    {event.actor === 'owner'
                      ? 'Owner'
                      : event.actor.slice(0, 8)}
                  </td>
                  <td>
                    <code>{event.resource}</code>
                  </td>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!audit.length && !loading ? (
            <p className="table-empty">No events yet.</p>
          ) : null}
        </div>
      ) : null}
      {page === 'backups' ? (
        <>
          {backupAllowed ? (
            <>
              <div className="backup-callout">
                <div>
                  <ShieldCheck />
                  <h2>A safe place to come back to.</h2>
                  <p>
                    Includes flows, releases, credential hashes, logs, and
                    complete imported spreadsheet and SQLite copies. Store
                    downloads privately. Back up the secret key file separately.
                    External databases are not included.
                  </p>
                </div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void task(async () => {
                      await api('/api/backups', token, 'POST')
                      await refresh()
                      message('Workspace backup created.')
                    })
                  }
                >
                  <Plus />
                  Create backup
                </Button>
              </div>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Backup</th>
                      <th>Size</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <tr key={backup.id}>
                        <td>
                          <code>{backup.id.slice(0, 8)}.sqlite</code>
                        </td>
                        <td>{Math.ceil(backup.bytes / 1024)} KB</td>
                        <td>{new Date(backup.createdAt).toLocaleString()}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void task(async () => {
                                const response = await authenticatedFetch(
                                  `/api/backups/${backup.id}`,
                                  token,
                                )
                                if (!response.ok)
                                  throw new Error('Download failed')
                                const url = URL.createObjectURL(
                                  await response.blob(),
                                )
                                const anchor = document.createElement('a')
                                anchor.href = url
                                anchor.download = backup.id
                                anchor.click()
                                setTimeout(() => URL.revokeObjectURL(url), 1000)
                                message('Backup downloaded.')
                              })
                            }
                          >
                            <Download />
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!backups.length && !loading ? (
                  <p className="table-empty">Create your first backup.</p>
                ) : null}
              </div>
            </>
          ) : (
            <p>
              Manage workspace backups access is needed to create or download
              backups.
            </p>
          )}
          {migrationsAllowed ? (
            <>
              <h2 className="section-title">Migration history</h2>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Change</th>
                      <th>Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {migrations.map((migration) => (
                      <tr key={migration.version}>
                        <td>{migration.version}</td>
                        <td>{migration.name}</td>
                        <td>
                          {new Date(migration.applied_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>
              Read migration history access is needed to view database
              migrations.
            </p>
          )}
        </>
      ) : null}
    </>
  )
}
