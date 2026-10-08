import { useEffect, useRef, useState } from 'react'
import type {
  DependencyUse,
  MemberAccessInput,
} from '../src/workspace/flow-access'
import type {
  DependencyAuth,
  DependencyDatabase,
  DependencySource,
} from '../src/workspace/dependency-model'
import { Button } from './components/ui/button'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { api, ApiError, type Member, type SavedFlow } from './lib/api'
import { useStudio } from './store'

export type DependencyCatalog = {
  sources: DependencySource[]
  databaseConnections: DependencyDatabase[]
  authConnections: DependencyAuth[]
}

export const emptyDependencyCatalog: DependencyCatalog = {
  sources: [],
  databaseConnections: [],
  authConnections: [],
}

const dependencyGroups = [
  { key: 'sources', label: 'Use spreadsheet sources', item: 'spreadsheet' },
  {
    key: 'databaseConnections',
    label: 'Use SQLite copies',
    item: 'SQLite copy',
  },
  {
    key: 'authConnections',
    label: 'Use product login connections',
    item: 'product login',
  },
] as const

export function emptyDependencyUse(): DependencyUse {
  return { sources: [], databaseConnections: [], authConnections: [] }
}

function memberAccessInput(member: Member): MemberAccessInput {
  return member.access.mode === 'all'
    ? { mode: 'all' }
    : {
        mode: 'selected',
        flowIds: [...member.access.flowIds],
        dependencyUse: {
          sources: [...member.access.dependencyUse.sources],
          databaseConnections: [
            ...member.access.dependencyUse.databaseConnections,
          ],
          authConnections: [...member.access.dependencyUse.authConnections],
        },
      }
}

export function selectedRoleCompatible(role: string, permissions: string[]) {
  return (
    role === 'viewer' ||
    (role === 'custom' &&
      permissions.every((permission) =>
        [
          'flows.read',
          'flows.write',
          'flows.test',
          'flows.publish',
          'runtime-keys.manage',
          'load-tests.run',
        ].includes(permission),
      ))
  )
}

export function FlowAccessFields({
  value,
  onChange,
  flows,
  dependencies,
  disabled,
  compatible,
  label,
}: {
  value: MemberAccessInput
  onChange: (value: MemberAccessInput) => void
  flows: SavedFlow[]
  dependencies: DependencyCatalog
  disabled: boolean
  compatible: boolean
  label: string
}) {
  return (
    <section className="role-editor" aria-label={label}>
      <h3>API access</h3>
      <Select
        label={label}
        value={value.mode}
        disabled={disabled}
        onValueChange={(mode) =>
          onChange(
            mode === 'all'
              ? { mode: 'all' }
              : {
                  mode: 'selected',
                  flowIds: [],
                  dependencyUse: emptyDependencyUse(),
                },
          )
        }
        options={[
          { value: 'all', label: 'All APIs' },
          { value: 'selected', label: 'Selected APIs only' },
        ]}
      />
      <p>
        Selected sharing limits API scope. Use Viewer or a custom role with only
        API, runtime-key and load-test actions. Actions still require separate
        role grants. It grants no API creation or global resource management.
      </p>
      {value.mode === 'selected' ? (
        <>
          {!compatible ? (
            <p className="form-error" role="alert">
              This role has actions beyond Read APIs and selected API
              operations. Choose an eligible custom role or Viewer, or
              explicitly select All APIs before continuing.
            </p>
          ) : null}
          <fieldset className="role-grant-groups">
            <legend>Choose APIs to share</legend>
            {flows.map((flow) => (
              <label key={flow.id} className="permission-option">
                <Checkbox
                  aria-label={`Share ${flow.name}`}
                  checked={value.flowIds.includes(flow.id)}
                  disabled={
                    disabled ||
                    !compatible ||
                    (value.flowIds.length >= 256 &&
                      !value.flowIds.includes(flow.id))
                  }
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      mode: 'selected',
                      flowIds: checked
                        ? [...value.flowIds, flow.id]
                        : value.flowIds.filter((id) => id !== flow.id),
                    })
                  }
                />
                <span>
                  {flow.name}
                  <small>
                    {flow.graphql ? 'GraphQL' : flow.method} {flow.path}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <p>
            {value.flowIds.length
              ? `${value.flowIds.length} APIs selected.`
              : 'No APIs selected. This member can sign in, but sees no APIs.'}
          </p>
          <h3>Dependencies these APIs may use</h3>
          <p>
            USE permits these selected APIs to read chosen dependency data or
            trigger product login when the role allows testing, publishing or
            callers. It can expose stored data through the API. It grants no
            dependency preview or management. Row, column and tenant
            authorization remain separate; selecting APIs or dependencies does
            not provide them.
          </p>
          {dependencyGroups.map((group) => (
            <fieldset className="role-grant-groups" key={group.key}>
              <legend>{group.label}</legend>
              {dependencies[group.key].length ? (
                dependencies[group.key].map((dependency) => (
                  <label key={dependency.id} className="permission-option">
                    <Checkbox
                      aria-label={`Use ${group.item} ${dependency.name}`}
                      checked={value.dependencyUse[group.key].includes(
                        dependency.id,
                      )}
                      disabled={
                        disabled ||
                        !compatible ||
                        (value.dependencyUse[group.key].length >= 256 &&
                          !value.dependencyUse[group.key].includes(
                            dependency.id,
                          ))
                      }
                      onCheckedChange={(checked) =>
                        onChange({
                          ...value,
                          dependencyUse: {
                            ...value.dependencyUse,
                            [group.key]: checked
                              ? [
                                  ...value.dependencyUse[group.key],
                                  dependency.id,
                                ]
                              : value.dependencyUse[group.key].filter(
                                  (id) => id !== dependency.id,
                                ),
                          },
                        })
                      }
                    />
                    <span>
                      {dependency.name}
                      <small>
                        Structure only · version {dependency.version}
                      </small>
                    </span>
                  </label>
                ))
              ) : (
                <p>No saved dependencies in this group.</p>
              )}
            </fieldset>
          ))}
          <p>
            {Object.values(value.dependencyUse).reduce(
              (count, ids) => count + ids.length,
              0,
            )}{' '}
            dependencies allowed for USE.
          </p>
        </>
      ) : (
        <p>
          All current and future APIs. Actions still follow the assigned role.
        </p>
      )}
    </section>
  )
}

export function FlowAccessEditor({
  member,
  onChanged,
  onRefreshed,
  onClose,
}: {
  member: Member
  onChanged: () => Promise<void>
  onRefreshed: (member: Member) => void
  onClose: () => void
}) {
  const state = useStudio()
  const [person, setPerson] = useState(member)
  const [value, setValue] = useState<MemberAccessInput>(() =>
    memberAccessInput(member),
  )
  const [flows, setFlows] = useState<SavedFlow[]>([])
  const [dependencies, setDependencies] = useState<DependencyCatalog>(
    emptyDependencyCatalog,
  )
  const [loading, setLoading] = useState(true)
  const [known, setKnown] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const active = useRef(false)
  const pending = useRef(false)
  const request = useRef(0)
  function current() {
    const live = useStudio.getState()
    return (
      active.current &&
      live.member?.role === 'owner' &&
      live.member.id === state.member?.id &&
      live.sessionId === state.sessionId &&
      live.token === state.token
    )
  }
  async function read(explicit = false) {
    if (!current()) return
    const seq = ++request.current
    setLoading(true)
    setKnown(false)
    try {
      const [people, available, sources, databaseConnections, authConnections] =
        await Promise.all([
          api<Member[]>('/api/members', state.token),
          api<SavedFlow[]>('/api/flows', state.token),
          api<DependencySource[]>('/api/dependencies/sources', state.token),
          api<DependencyDatabase[]>(
            '/api/dependencies/database-connections',
            state.token,
          ),
          api<DependencyAuth[]>(
            '/api/dependencies/auth-connections',
            state.token,
          ),
        ])
      if (!current() || seq !== request.current) return
      const latest = people.find((item) => item.id === member.id)
      if (!latest)
        throw new Error(
          'This member is no longer available. Close sharing and refresh the team.',
        )
      setPerson(latest)
      onRefreshed(latest)
      setValue(memberAccessInput(latest))
      setFlows(available)
      setDependencies({ sources, databaseConnections, authConnections })
      setReview(false)
      setKnown(true)
      setError('')
      if (explicit)
        state.message(
          'API access refreshed. Review current selections before saving.',
        )
    } catch (reason) {
      if (current() && seq === request.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not read API sharing.',
        )
    } finally {
      if (current() && seq === request.current) setLoading(false)
    }
  }
  useEffect(() => {
    if (state.member?.role !== 'owner') return
    active.current = true
    if (current()) {
      heading.current?.focus({ preventScroll: true })
      heading.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
    void read()
    return () => {
      active.current = false
      request.current++
    }
  }, [
    member.id,
    state.token,
    state.sessionId,
    state.member?.id,
    state.member?.role,
  ])

  const compatible = selectedRoleCompatible(person.role, person.permissions)
  const disabled = state.busy || loading
  const valid = known && (value.mode === 'all' || compatible)
  if (state.member?.role !== 'owner') return null
  return (
    <section
      className="roles-panel"
      aria-label={`API sharing for ${member.name}`}
    >
      <div className="panel-heading">
        <h2 ref={heading} tabIndex={-1}>
          API sharing for {member.name}
        </h2>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => void state.task(() => read(true))}
        >
          Refresh API access
        </Button>
      </div>
      <p>
        Access version {person.access.version}. Refresh replaces unsaved
        selections with the owner's current policy.
      </p>
      {loading ? <p>Loading API sharing…</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error} Refresh API access and review before trying again.
        </p>
      ) : null}
      <FlowAccessFields
        label={`API access for ${member.name}`}
        value={value}
        onChange={setValue}
        flows={flows}
        dependencies={dependencies}
        compatible={compatible}
        disabled={disabled || !known || review}
      />
      {review ? (
        <section className="role-editor" aria-label="Review API sharing">
          <h3>Review API sharing</h3>
          <p>
            {value.mode === 'all'
              ? 'All current and future APIs'
              : value.flowIds.length
                ? flows
                    .filter((flow) => value.flowIds.includes(flow.id))
                    .map((flow) => `${flow.name} (${flow.path})`)
                    .join(' · ')
                : 'No APIs selected'}
          </p>
          {value.mode === 'selected' ? (
            <p>
              Dependency USE:{' '}
              {dependencyGroups
                .map(
                  (group) =>
                    `${group.label}: ${value.dependencyUse[group.key].length ? value.dependencyUse[group.key].map((id) => dependencies[group.key].find((dependency) => dependency.id === id)?.name ?? `Unavailable (${id})`).join(', ') : 'none'}`,
                )
                .join(' · ')}
            </p>
          ) : null}
          <p>
            Confirm this policy for {member.name}? Their browser sessions will
            end. Their member key immediately uses this policy. This does not
            grant role actions or runtime calls. Dependency USE may expose data
            through the chosen APIs; it grants no global resource management.
          </p>
          <div className="title-actions">
            <Button
              disabled={disabled || !valid}
              onClick={() => {
                if (
                  !current() ||
                  useStudio.getState().busy ||
                  pending.current ||
                  !valid
                )
                  return
                pending.current = true
                void state
                  .task(async () => {
                    let saved = false
                    try {
                      const updated = await api<Member>(
                        `/api/members/${member.id}/access`,
                        state.token,
                        'PUT',
                        { ...value, version: person.access.version },
                      )
                      if (!current()) return
                      saved = true
                      setPerson(updated)
                      setKnown(true)
                      setError('')
                      setReview(false)
                      await onChanged()
                      if (current())
                        state.message(
                          'API sharing updated. Their browser sessions were ended.',
                        )
                    } catch (reason) {
                      if (!current()) return
                      const unconfirmed =
                        !(reason instanceof ApiError) || reason.status >= 500
                      if (
                        saved ||
                        unconfirmed ||
                        (reason instanceof ApiError && reason.status === 409)
                      )
                        setKnown(false)
                      setReview(false)
                      setError(
                        saved
                          ? 'API sharing was saved, but team records could not be refreshed.'
                          : unconfirmed
                            ? 'Could not confirm whether API sharing was saved. Refresh to read the current policy.'
                            : reason instanceof Error
                              ? reason.message
                              : 'Could not update API sharing.',
                      )
                    }
                  })
                  .finally(() => {
                    pending.current = false
                  })
              }}
            >
              Confirm API sharing
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => setReview(false)}
            >
              Cancel sharing review
            </Button>
          </div>
        </section>
      ) : (
        <Button
          variant="outline"
          disabled={disabled || !valid}
          onClick={() => setReview(true)}
        >
          Review API sharing
        </Button>
      )}
      <Button variant="ghost" disabled={state.busy} onClick={onClose}>
        Close API sharing
      </Button>
    </section>
  )
}
