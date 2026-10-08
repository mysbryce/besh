import { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { Badge } from './components/ui/badge'
import { api, memberRoleName, type Member, type Role } from './lib/api'
import { useStudio } from './store'
import type { Permission } from '../src/workspace/permissions'

type CatalogEntry = {
  id: Permission
  label: string
  description: string
  group: string
}

export function roleOptions(roles: Role[]) {
  return [
    { value: 'viewer', label: 'Viewer · read APIs' },
    { value: 'editor', label: 'Editor · build and test' },
    ...roles.map((role) => ({
      value: role.id,
      label: `${role.name} · custom role`,
    })),
  ]
}

export function roleChoice(value: string) {
  return value === 'viewer' || value === 'editor'
    ? { role: value }
    : { role: 'custom', roleId: value }
}

export function MemberAssignment({
  member,
  roles,
  onChanged,
}: {
  member: Member
  roles: Role[]
  onChanged: () => Promise<void>
}) {
  const state = useStudio()
  const [selected, setSelected] = useState(member.roleId ?? member.role)
  const [error, setError] = useState('')
  useEffect(() => {
    setSelected(member.roleId ?? member.role)
  }, [member.roleId, member.role])
  const current = member.roleId ?? member.role
  useEffect(() => {
    if (
      selected !== 'viewer' &&
      selected !== 'editor' &&
      !roles.some((role) => role.id === selected)
    )
      setSelected(current)
  }, [selected, roles, current])
  return (
    <div className="member-assignment">
      <Select
        label={`Role for ${member.name}`}
        value={selected}
        options={roleOptions(roles)}
        disabled={state.busy}
        onValueChange={setSelected}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={state.busy || selected === current}
        onClick={() => {
          const next =
            roles.find((role) => role.id === selected)?.name ?? selected
          if (
            !confirm(
              `Change ${member.name}'s role from ${memberRoleName(member)} to ${next}? This ends their active browser sessions. Their member key immediately uses the new permissions.`,
            )
          )
            return
          setError('')
          void state.task(async () => {
            try {
              await api(
                `/api/members/${member.id}/role`,
                state.token,
                'PUT',
                roleChoice(selected),
              )
              await onChanged()
              state.message(
                'Member role updated. Their browser sessions were ended.',
              )
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : 'Could not update member role.',
              )
              throw reason
            }
          })
        }}
      >
        Change role
      </Button>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Roles({
  roles,
  onChanged,
}: {
  roles: Role[]
  onChanged: () => Promise<void>
}) {
  const state = useStudio()
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [draft, setDraft] = useState<{
    role: Role | null
    name: string
    permissions: Permission[]
  } | null>(null)
  const [error, setError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    void api<CatalogEntry[]>('/api/permissions', state.token)
      .then((value) => {
        if (active) {
          setCatalog(value)
          setCatalogError('')
        }
      })
      .catch((reason: Error) => {
        if (active) setCatalogError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [state.token, state.sessionId, refresh])
  const groups = [...new Set(catalog.map((entry) => entry.group))]

  return (
    <section aria-label="Custom roles" className="roles-panel">
      <div className="panel-heading">
        <h2>Custom roles</h2>
        <Button
          variant="outline"
          disabled={state.busy || !!draft || loading || !!catalogError}
          onClick={() => {
            setError('')
            setDraft({ role: null, name: '', permissions: [] })
          }}
        >
          New role
        </Button>
      </div>
      <p>
        Choose actions for this local workspace. Every member can manage their
        own account and sessions. Member and role administration stays with the
        owner.
      </p>
      <p>
        Actions are separate: editing, testing, and publication each need their
        own grant. Reading related APIs or connections is needed to choose them
        in forms.
      </p>
      {loading ? <p>Loading permission choices…</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {catalogError ? (
        <p role="alert" className="form-error">
          {catalogError}{' '}
          <Button
            variant="ghost"
            disabled={state.busy}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry permission choices
          </Button>
        </p>
      ) : null}
      {draft ? (
        <form
          className="role-editor"
          onSubmit={(event) => {
            event.preventDefault()
            if (state.busy || loading || !!catalogError || !draft.name.trim())
              return
            if (
              draft.role &&
              !confirm(
                `Save changes to ${draft.role.name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.`,
              )
            )
              return
            setError('')
            void state.task(async () => {
              try {
                await api(
                  draft.role ? `/api/roles/${draft.role.id}` : '/api/roles',
                  state.token,
                  draft.role ? 'PUT' : 'POST',
                  {
                    name: draft.name.trim(),
                    permissions: draft.permissions,
                    ...(draft.role ? { version: draft.role.version } : {}),
                  },
                )
                setDraft(null)
                await onChanged()
                state.message(
                  draft.role
                    ? 'Role updated. Changed grants end affected browser sessions.'
                    : 'Role created. Assign it to a member when ready.',
                )
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : 'Could not save role.',
                )
                throw reason
              }
            })
          }}
        >
          <h3>
            {draft.role
              ? `Edit ${draft.role.name} · version ${draft.role.version}`
              : 'Create custom role'}
          </h3>
          <label>
            Role name
            <Input
              aria-label="Role name"
              value={draft.name}
              disabled={state.busy}
              maxLength={80}
              required
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          <div className="role-grant-groups">
            {groups.map((group) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {catalog
                  .filter((entry) => entry.group === group)
                  .map((entry) => (
                    <label className="permission-option" key={entry.id}>
                      <Checkbox
                        checked={draft.permissions.includes(entry.id)}
                        disabled={state.busy}
                        aria-label={entry.label}
                        onCheckedChange={(checked) =>
                          setDraft({
                            ...draft,
                            permissions: checked
                              ? [...draft.permissions, entry.id]
                              : draft.permissions.filter(
                                  (permission) => permission !== entry.id,
                                ),
                          })
                        }
                      />
                      <span>
                        {entry.label}
                        <small>{entry.description}</small>
                      </span>
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>
          {!draft.permissions.length ? (
            <p>
              No workspace action grants. Members with this role can still sign
              in and manage their own account.
            </p>
          ) : null}
          {draft.permissions.includes('backups.manage') ? (
            <p className="role-warning">
              Backup access exposes the entire workspace, including saved data
              and sensitive credential records. Keep downloads private.
            </p>
          ) : null}
          {draft.permissions.includes('load-tests.run') ? (
            <p className="role-warning">
              Load testing repeatedly executes live APIs. Configured writes can
              change product data. Grant only to trusted operators.
            </p>
          ) : null}
          <div className="title-actions">
            <Button
              disabled={
                state.busy || loading || !!catalogError || !draft.name.trim()
              }
            >
              Save role
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={state.busy}
              onClick={() => {
                setDraft(null)
                setError('')
              }}
            >
              Cancel role changes
            </Button>
          </div>
          {draft.role ? (
            <p>
              If another owner session changes this role, refresh the members
              page and reopen the role before saving again.
            </p>
          ) : null}
        </form>
      ) : null}
      <div className="role-list">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <h3>
              {role.name}{' '}
              <Badge variant="outline">Custom · v{role.version}</Badge>
            </h3>
            <p>
              {role.permissions.length
                ? role.permissions
                    .map(
                      (permission) =>
                        catalog.find((entry) => entry.id === permission)
                          ?.label ?? permission,
                    )
                    .join(' · ')
                : 'Account and own sessions only'}
            </p>
            <div className="title-actions">
              <Button
                variant="outline"
                disabled={state.busy || !!draft || !!catalogError}
                onClick={() => {
                  setError('')
                  setDraft({
                    role,
                    name: role.name,
                    permissions: [...role.permissions],
                  })
                }}
              >
                Edit {role.name}
              </Button>
              <Button
                variant="ghost"
                disabled={state.busy || !!draft || !!catalogError}
                onClick={() => {
                  if (
                    !confirm(
                      `Delete role ${role.name}? This cannot be undone. Roles assigned to members cannot be deleted.`,
                    )
                  )
                    return
                  setError('')
                  void state.task(async () => {
                    try {
                      await api(
                        `/api/roles/${role.id}`,
                        state.token,
                        'DELETE',
                        { version: role.version },
                      )
                      await onChanged()
                      state.message('Role deleted.')
                    } catch (reason) {
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : 'Could not delete role.',
                      )
                      throw reason
                    }
                  })
                }}
              >
                Delete {role.name}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!roles.length && !loading ? (
        <p>
          No custom roles yet. Built-in owner, editor, and viewer roles stay
          available.
        </p>
      ) : null}
    </section>
  )
}
