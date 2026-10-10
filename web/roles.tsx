import { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { Badge } from './components/ui/badge'
import { api, type Member, type Role } from './lib/api'
import { useStudio } from './store'
import { translateMessage, useTranslation } from './i18n'
import type { Permission } from '../src/workspace/permissions'

type CatalogEntry = {
  id: Permission
  label: string
  description: string
  group: string
}

export function roleOptions(roles: Role[], t: typeof translateMessage) {
  return [
    { value: 'viewer', label: t('Viewer · read APIs') },
    { value: 'editor', label: t('Editor · build and test') },
    ...roles.map((role) => ({
      value: role.id,
      label: t('{name} · custom role', { name: role.name }),
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
  const { t } = useTranslation()
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
        label={t('Role for {name}', { name: member.name })}
        value={selected}
        options={roleOptions(roles, t)}
        disabled={state.busy}
        onValueChange={setSelected}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={state.busy || selected === current}
        onClick={() => {
          const next =
            selected === 'viewer' || selected === 'editor'
              ? t(selected)
              : (roles.find((role) => role.id === selected)?.name ?? selected)
          const currentName =
            member.role === 'custom'
              ? (member.roleName ?? t('Custom role'))
              : t(member.role)
          if (
            !confirm(
              t(
                "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.",
                { name: member.name, current: currentName, next },
              ),
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
                translateMessage(
                  'Member role updated. Their browser sessions were ended.',
                ),
              )
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : translateMessage('Could not update member role.'),
              )
              throw reason
            }
          })
        }}
      >
        {t('Change role')}
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
  recordsLoading,
  onChanged,
}: {
  roles: Role[]
  recordsLoading: boolean
  onChanged: () => Promise<void>
}) {
  const state = useStudio()
  const { t } = useTranslation()
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
    <section aria-label={t('Custom roles')} className="roles-panel">
      <div className="panel-heading">
        <h2>{t('Custom roles')}</h2>
        <Button
          variant="outline"
          disabled={
            state.busy || !!draft || loading || recordsLoading || !!catalogError
          }
          onClick={() => {
            setError('')
            setDraft({ role: null, name: '', permissions: [] })
          }}
        >
          {t('New role')}
        </Button>
      </div>
      <p>
        {t(
          'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.',
        )}
      </p>
      <p>
        {t(
          'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.',
        )}
      </p>
      {loading ? <p>{t('Loading permission choices…')}</p> : null}
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
            {t('Retry permission choices')}
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
                t(
                  'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.',
                  { name: draft.role.name },
                ),
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
                  translateMessage(
                    draft.role
                      ? 'Role updated. Changed grants end affected browser sessions.'
                      : 'Role created. Assign it to a member when ready.',
                  ),
                )
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : translateMessage('Could not save role.'),
                )
                throw reason
              }
            })
          }}
        >
          <h3>
            {draft.role
              ? t('Edit {name} · version {version}', {
                  name: draft.role.name,
                  version: draft.role.version,
                })
              : t('Create custom role')}
          </h3>
          <label>
            {t('Role name')}
            <Input
              aria-label={t('Role name')}
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
                <legend>{t(group)}</legend>
                {catalog
                  .filter((entry) => entry.group === group)
                  .map((entry) => (
                    <label className="permission-option" key={entry.id}>
                      <Checkbox
                        checked={draft.permissions.includes(entry.id)}
                        disabled={state.busy}
                        aria-label={t(entry.label)}
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
                        {t(entry.label)}
                        <small>{t(entry.description)}</small>
                      </span>
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>
          {!draft.permissions.length ? (
            <p>
              {t(
                'No workspace action grants. Members with this role can still sign in and manage their own account.',
              )}
            </p>
          ) : null}
          {draft.permissions.includes('backups.manage') ? (
            <p className="role-warning">
              {t(
                'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.',
              )}
            </p>
          ) : null}
          {draft.permissions.includes('load-tests.run') ? (
            <p className="role-warning">
              {t(
                'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.',
              )}
            </p>
          ) : null}
          <div className="title-actions">
            <Button
              disabled={
                state.busy || loading || !!catalogError || !draft.name.trim()
              }
            >
              {t('Save role')}
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
              {t('Cancel role changes')}
            </Button>
          </div>
          {draft.role ? (
            <p>
              {t(
                'If another owner session changes this role, refresh the members page and reopen the role before saving again.',
              )}
            </p>
          ) : null}
        </form>
      ) : null}
      <div className="role-list">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <h3>
              {role.name}{' '}
              <Badge variant="outline">
                {t('Custom · v{version}', { version: role.version })}
              </Badge>
            </h3>
            <p>
              {role.permissions.length
                ? role.permissions
                    .map((permission) => {
                      const entry = catalog.find(
                        (entry) => entry.id === permission,
                      )
                      return entry ? t(entry.label) : permission
                    })
                    .join(' · ')
                : t('Account and own sessions only')}
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
                {t('Edit {name}', { name: role.name })}
              </Button>
              <Button
                variant="ghost"
                disabled={state.busy || !!draft || !!catalogError}
                onClick={() => {
                  if (
                    !confirm(
                      t(
                        'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.',
                        { name: role.name },
                      ),
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
                      state.message(translateMessage('Role deleted.'))
                    } catch (reason) {
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : translateMessage('Could not delete role.'),
                      )
                      throw reason
                    }
                  })
                }}
              >
                {t('Delete {name}', { name: role.name })}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!roles.length && !loading ? (
        <p>
          {t(
            'No custom roles yet. Built-in owner, editor, and viewer roles stay available.',
          )}
        </p>
      ) : null}
    </section>
  )
}
