import { useEffect, useRef, useState } from 'react'
import type { FlowAccessInput } from '../src/workspace/flow-access'
import { Button } from './components/ui/button'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { api, ApiError, type Member, type SavedFlow } from './lib/api'
import { useStudio } from './store'

export function FlowAccessFields({
  value,
  onChange,
  flows,
  disabled,
  compatible,
  label,
}: {
  value: FlowAccessInput
  onChange: (value: FlowAccessInput) => void
  flows: SavedFlow[]
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
              : { mode: 'selected', flowIds: [] },
          )
        }
        options={[
          { value: 'all', label: 'All APIs' },
          { value: 'selected', label: 'Selected APIs only' },
        ]}
      />
      <p>
        Selected sharing is read-only: use Viewer or a custom role with only
        Read APIs, or no action grants. It grants no editing, testing,
        publication, runtime keys or access to related resources.
      </p>
      {value.mode === 'selected' ? (
        <>
          {!compatible ? (
            <p className="form-error" role="alert">
              This role has actions beyond Read APIs. Choose a read-only role or
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
  const [value, setValue] = useState<FlowAccessInput>(
    member.flowAccess.mode === 'all'
      ? { mode: 'all' }
      : { mode: 'selected', flowIds: [...member.flowAccess.flowIds] },
  )
  const [flows, setFlows] = useState<SavedFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [known, setKnown] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
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
      const [people, available] = await Promise.all([
        api<Member[]>('/api/members', state.token),
        api<SavedFlow[]>('/api/flows', state.token),
      ])
      if (!current() || seq !== request.current) return
      const latest = people.find((item) => item.id === member.id)
      if (!latest)
        throw new Error(
          'This member is no longer available. Close sharing and refresh the team.',
        )
      setPerson(latest)
      onRefreshed(latest)
      setValue(
        latest.flowAccess.mode === 'all'
          ? { mode: 'all' }
          : { mode: 'selected', flowIds: [...latest.flowAccess.flowIds] },
      )
      setFlows(available)
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

  const compatible =
    person.role === 'viewer' ||
    (person.role === 'custom' &&
      person.permissions.every((permission) => permission === 'flows.read'))
  const disabled = state.busy || loading
  const valid = known && (value.mode === 'all' || compatible)
  if (state.member?.role !== 'owner') return null
  return (
    <section
      className="roles-panel"
      aria-label={`API sharing for ${member.name}`}
    >
      <div className="panel-heading">
        <h2>API sharing for {member.name}</h2>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => void state.task(() => read(true))}
        >
          Refresh API access
        </Button>
      </div>
      <p>
        Access version {person.flowAccess.version}. Refresh replaces unsaved
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
          <p>
            Confirm this policy for {member.name}? Their browser sessions will
            end. Their member key immediately uses this policy. This does not
            grant runtime calls or related resources.
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
                        `/api/members/${member.id}/flow-access`,
                        state.token,
                        'PUT',
                        { ...value, version: person.flowAccess.version },
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
