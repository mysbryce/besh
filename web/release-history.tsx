import { useEffect, useRef, useState } from 'react'
import type { Flow } from '../src/flows/model'
import { api, type SavedFlow, type PublishedEndpoint } from './lib/api'
import { flowTransport, type FlowTransport } from '../src/flows/transport'
import { useStudio } from './store'
import { can } from '../src/workspace/permissions'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'

type Release = {
  revision: number
  createdAt: string
  endpoint: PublishedEndpoint
  current: boolean
}
type Detail = {
  revision: number
  createdAt: string
  definition: Flow
  current: boolean
}

function route(flow: {
  method: string
  path: string
  graphql?: unknown
  websocket?: unknown
  transport?: FlowTransport
}) {
  const transport = flow.transport ?? flowTransport(flow)
  return `${transport === 'websocket' ? 'WebSocket' : flow.method} ${transport === 'websocket' ? '/ws' : transport === 'graphql' ? '/graphql' : '/run'}${flow.path}`
}

export function ReleaseHistory() {
  const state = useStudio()
  const [expanded, setExpanded] = useState(false)
  const [releases, setReleases] = useState<Release[]>([])
  const [detail, setDetail] = useState<Detail | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const cancel = useRef<HTMLButtonElement>(null)
  const rollbackButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const latest = useRef(0)

  useEffect(() => {
    if (!expanded || !state.id) return
    let active = true
    setLoading(true)
    setError('')
    setDetail(null)
    setConfirming(false)
    void api<Release[]>(`/api/flows/${state.id}/releases`, state.token)
      .then((value) => {
        if (!active) return
        setReleases(value)
        const current = value.find((release) => release.current)
        if (
          current &&
          useStudio.getState().editorSession === state.editorSession
        )
          useStudio.setState((studio) => ({
            publishedRevision: current.revision,
            flows: studio.flows.map((flow) =>
              flow.id === state.id
                ? {
                    ...flow,
                    publishedRevision: current.revision,
                    publishedEndpoint: current.endpoint,
                  }
                : flow,
            ),
          }))
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      latest.current++
    }
  }, [
    expanded,
    state.id,
    state.editorSession,
    state.publishedRevision,
    refresh,
  ])

  useEffect(() => {
    if (confirming) {
      if (!dialog.current?.open) dialog.current?.showModal()
      cancel.current?.focus()
    }
  }, [confirming])

  function closeConfirmation() {
    if (useStudio.getState().busy) return
    setConfirming(false)
    rollbackButton.current?.focus()
  }

  async function review(revision: number) {
    const request = ++latest.current
    const session = state.editorSession
    setLoading(true)
    setError('')
    setDetail(null)
    try {
      const value = await api<Detail>(
        `/api/flows/${state.id}/releases/${revision}`,
        state.token,
      )
      if (
        request === latest.current &&
        useStudio.getState().editorSession === session
      )
        setDetail(value)
    } catch (reason) {
      if (request === latest.current)
        setError(
          reason instanceof Error ? reason.message : 'Could not load release.',
        )
    } finally {
      if (request === latest.current) setLoading(false)
    }
  }

  function rollback() {
    if (!detail || !state.id || !can(state.member, 'flows.publish')) return
    const revision = detail.revision
    const expected = state.publishedRevision
    const id = state.id
    const session = state.editorSession
    void state.task(async () => {
      const flow = await api<SavedFlow>(
        `/api/flows/${id}/rollback`,
        state.token,
        'POST',
        { revision, publishedRevision: expected },
      )
      if (useStudio.getState().editorSession !== session) return
      // Refresh only release metadata so unsaved draft changes survive rollback.
      useStudio.setState((current) => ({
        publishedRevision: flow.publishedRevision,
        flows: current.flows.map((item) =>
          item.id === id
            ? {
                ...item,
                publishedRevision: flow.publishedRevision,
                publishedEndpoint: flow.publishedEndpoint,
              }
            : item,
        ),
      }))
      setConfirming(false)
      setDetail(null)
      setRefresh((value) => value + 1)
      state.message(
        `Rolled back to release ${revision} · ${route(flow.publishedEndpoint!)}`,
      )
    })
  }

  return (
    <section className="release-history">
      <Button
        variant="ghost"
        aria-expanded={expanded}
        disabled={!state.id || state.busy}
        onClick={() => setExpanded(!expanded)}
      >
        Release history
      </Button>
      {expanded ? (
        <>
          <p>
            Review immutable releases. Rollback changes the live endpoint and
            its rules. Your saved and unsaved draft stay unchanged.
          </p>
          <Button
            variant="outline"
            disabled={state.busy || loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh releases
          </Button>
          {loading ? <p>Loading releases…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {!loading && !error && !releases.length ? (
            <p>No releases yet. Publish a saved draft to create one.</p>
          ) : null}
          <div className="release-list">
            {releases.map((release) => (
              <div className="release-row" key={release.revision}>
                <div>
                  <strong>Release {release.revision}</strong>{' '}
                  {release.current ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : null}
                  <p>{route(release.endpoint)}</p>
                  <small>{new Date(release.createdAt).toLocaleString()}</small>
                </div>
                <Button
                  variant="outline"
                  disabled={state.busy || loading}
                  onClick={() => void review(release.revision)}
                >
                  Review release {release.revision}
                </Button>
              </div>
            ))}
          </div>
          {detail ? (
            <section aria-label="Release review" className="release-review">
              <h3>
                Release {detail.revision} · {detail.definition.name}
              </h3>
              <p>{route(detail.definition)}</p>
              <p>
                {detail.definition.nodes.length} steps ·{' '}
                {detail.definition.graphql
                  ? 'GraphQL schema'
                  : detail.definition.contract
                    ? 'REST API rules'
                    : 'REST without API rules'}
              </p>
              {can(state.member, 'flows.publish') ? (
                <Button
                  ref={rollbackButton}
                  variant="outline"
                  disabled={
                    state.busy || detail.revision === state.publishedRevision
                  }
                  onClick={() => {
                    state.message(
                      'Review the target release before confirming rollback.',
                    )
                    setConfirming(true)
                  }}
                >
                  Roll back to release {detail.revision}
                </Button>
              ) : (
                <p>
                  Publish and roll back access is needed to change the live
                  release.
                </p>
              )}
              {detail.revision === state.publishedRevision ? (
                <p>This release is already live.</p>
              ) : null}
            </section>
          ) : null}
          {confirming && detail ? (
            <dialog
              className="rollback-confirm"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm rollback"
              ref={dialog}
              onCancel={(event) => {
                event.preventDefault()
                closeConfirmation()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeConfirmation()
                }
                if (event.key === 'Tab') {
                  const buttons = [
                    ...(dialog.current?.querySelectorAll<HTMLButtonElement>(
                      'button:not(:disabled)',
                    ) ?? []),
                  ]
                  const first = buttons[0]
                  const last = buttons.at(-1)
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last?.focus()
                  }
                  if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first?.focus()
                  }
                }
              }}
            >
              <h3>
                Replace live release {state.publishedRevision} with release{' '}
                {detail.revision}?
              </h3>
              <p>{route(detail.definition)}</p>
              <p>
                Existing API keys will call this release. Draft edits stay
                unchanged. Active load tests must finish before rollback.
              </p>
              {state.failed ? (
                <p role="alert">
                  {state.notice} Cancel rollback, refresh releases, then review
                  the current target.
                </p>
              ) : null}
              <div className="title-actions">
                <Button
                  ref={cancel}
                  variant="outline"
                  disabled={state.busy}
                  onClick={closeConfirmation}
                >
                  Cancel rollback
                </Button>
                <Button disabled={state.busy} onClick={rollback}>
                  {state.busy ? 'Rolling back…' : 'Confirm rollback'}
                </Button>
              </div>
            </dialog>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
