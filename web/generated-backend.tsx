import { useEffect, useRef, useState } from 'react'
import { Copy, Download, RefreshCw } from 'lucide-react'
import type { BackendCodeArtifact } from '../src/flows/backend-code-model'
import { can } from '../src/workspace/permissions'
import { Button } from './components/ui/button'
import { api, ApiError } from './lib/api'
import { useStudio } from './store'

export function GeneratedBackend() {
  const state = useStudio()
  const [artifact, setArtifact] = useState<BackendCodeArtifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unpublished, setUnpublished] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [copied, setCopied] = useState(false)
  const active = useRef(false)
  const sequence = useRef(0)
  const pending = useRef(false)
  const allowed = can(state.member, 'flows.read')

  function current() {
    const live = useStudio.getState()
    return (
      active.current &&
      live.id === state.id &&
      live.editorSession === state.editorSession &&
      live.sessionId === state.sessionId &&
      live.token === state.token &&
      live.member?.id === state.member?.id &&
      can(live.member, 'flows.read')
    )
  }

  useEffect(() => {
    if (!allowed || !state.id) return
    active.current = true
    let alive = true
    const seq = ++sequence.current
    setLoading(true)
    setArtifact(null)
    setError('')
    setCopied(false)
    setUnpublished(false)
    const expected =
      !refresh && state.publishedRevision
        ? `?revision=${state.publishedRevision}`
        : ''
    void api<BackendCodeArtifact>(
      `/api/flows/${state.id}/backend-code${expected}`,
      state.token,
    )
      .then((value) => {
        if (alive && seq === sequence.current && current()) setArtifact(value)
      })
      .catch((reason: unknown) => {
        if (!alive || seq !== sequence.current || !current()) return
        if (reason instanceof ApiError && reason.status === 404)
          setUnpublished(true)
        else
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not read the generated backend.',
          )
      })
      .finally(() => {
        if (alive && seq === sequence.current && current()) setLoading(false)
      })
    return () => {
      alive = false
      active.current = false
      sequence.current++
    }
  }, [
    allowed,
    state.id,
    state.editorSession,
    state.sessionId,
    state.member?.id,
    state.token,
    state.publishedRevision,
    refresh,
  ])

  function exportCode(action: 'copy' | 'download') {
    if (!artifact || !current() || useStudio.getState().busy || pending.current)
      return
    const reviewed = artifact
    const seq = sequence.current
    pending.current = true
    void state
      .task(async () => {
        if (!current()) return
        setError('')
        try {
          const confirmed = await api<BackendCodeArtifact>(
            `/api/flows/${state.id}/backend-code?revision=${reviewed.revision}`,
            state.token,
          )
          if (!current() || seq !== sequence.current) return
          if (
            confirmed.sha256 !== reviewed.sha256 ||
            confirmed.definitionSha256 !== reviewed.definitionSha256
          )
            throw new ApiError(
              'Generated backend changed. Refresh and review its current code.',
              409,
            )
          if (action === 'copy') {
            await navigator.clipboard.writeText(reviewed.code)
            if (current() && seq === sequence.current) {
              setCopied(true)
              state.message('Generated backend copied.')
            }
          } else {
            const url = URL.createObjectURL(
              new Blob([reviewed.code], { type: 'text/plain' }),
            )
            const link = document.createElement('a')
            link.href = url
            link.download = reviewed.filename
            link.click()
            URL.revokeObjectURL(url)
            state.message('Generated backend downloaded.')
          }
        } catch (reason) {
          if (!current() || seq !== sequence.current) return
          if (
            reason instanceof ApiError &&
            [404, 409].includes(reason.status)
          ) {
            setArtifact(null)
            setCopied(false)
          }
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not export the generated backend.',
          )
        }
      })
      .finally(() => {
        pending.current = false
      })
  }

  if (!allowed) return null
  const disabled = loading || state.busy
  return (
    <section
      className="client-code-panel release-history"
      aria-label="Generated backend"
    >
      <div className="panel-heading">
        <strong>Generated backend</strong>
        <span>PUBLISHED SERVER CODE</span>
      </div>
      <p>
        Publishing generates this backend automatically. Viewing or downloading
        its code does not call, publish or deploy an API.
      </p>
      <p className="credential-note">
        This module requires Besh runtime helpers. It is not a standalone
        server, data export or secret bundle. It contains configured flow
        literals; keep it private.
      </p>
      {state.dirty ||
      state.revision !== (artifact?.revision ?? state.publishedRevision) ? (
        <p className="credential-note">
          Draft changes are excluded. This view uses only the current published
          release; save and publish your changes to update its backend.
        </p>
      ) : null}
      <div className="simple-form">
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw /> Refresh generated backend
        </Button>
        {loading ? <p>Loading generated backend…</p> : null}
        {unpublished ? (
          <p>
            Publish this API to generate its backend. Refresh after publication
            to read the current release.
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error} Refresh generated backend to review the current release and
            retry.
          </p>
        ) : null}
        {artifact ? (
          <div className="client-code-result">
            <p>
              <strong>Published release · revision {artifact.revision}</strong>
              <br />
              <code>
                {artifact.endpoint.method} {artifact.endpoint.path}
              </code>
            </p>
            <p>
              Compiler version {artifact.compilerVersion} ·{' '}
              <code className="break-all">{artifact.filename}</code>
            </p>
            <details>
              <summary>Release integrity</summary>
              <p>
                Code SHA-256
                <br />
                <code className="break-all">{artifact.sha256}</code>
              </p>
              <p>
                Definition SHA-256
                <br />
                <code className="break-all">{artifact.definitionSha256}</code>
              </p>
            </details>
            <h3>Requirements</h3>
            <ul>
              {artifact.requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
            <pre
              aria-label="Generated backend code"
              tabIndex={0}
              className="code-input"
            >
              {artifact.code}
            </pre>
            <div className="title-actions">
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => exportCode('copy')}
              >
                <Copy />
                {copied ? 'Backend copied' : 'Copy backend code'}
              </Button>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => exportCode('download')}
              >
                <Download />
                Download backend code
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
