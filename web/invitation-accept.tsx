import { useTranslation } from './i18n'
import { LanguageControl } from './language'
import { useEffect, useRef, useState } from 'react'
import type { InvitationPreview } from '../src/auth/invitations'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import type { WorkspaceSession } from './lib/api'
import { ThemeControl } from './theme'
import { useStudio } from './store'

export function InvitationAccept({
  token,
  entryError,
  onConsumed,
  onReturn,
  onSignedOut,
  onSignIn,
}: {
  token: string | null
  entryError: string
  onConsumed: () => void
  onReturn: () => void
  onSignedOut: () => void
  onSignIn: () => void
}) {
  const { language, t } = useTranslation()
  const actor = useStudio()
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [sessionKnown, setSessionKnown] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [acceptedEmail, setAcceptedEmail] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  const previewRequest = useRef(0)
  const sessionRequest = useRef(0)
  const requests = useRef(new AbortController())
  const heading = useRef<HTMLHeadingElement>(null)

  async function send<T>(path: string, body?: unknown, csrfToken?: string) {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-Besh-CSRF': csrfToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requests.current.signal,
    })
    const result = await response.json()
    if (!response.ok)
      throw new Error(result.error ?? `Request failed (${response.status}).`)
    return result as T
  }

  async function readPreview() {
    if (!active.current || pending.current || token === null) return
    const sequence = ++previewRequest.current
    setPreviewLoading(true)
    setPreview(null)
    try {
      const value = await send<InvitationPreview>('/auth/invitations/preview', {
        token,
      })
      if (!active.current || sequence !== previewRequest.current) return
      setPreview(value)
      setPreviewError('')
    } catch (reason) {
      if (active.current && sequence === previewRequest.current)
        setPreviewError(
          reason instanceof Error
            ? reason.message
            : 'Could not read invitation.',
        )
    } finally {
      if (active.current && sequence === previewRequest.current)
        setPreviewLoading(false)
    }
  }

  async function readSession() {
    if (!active.current || pending.current) return
    const sequence = ++sessionRequest.current
    setSessionLoading(true)
    setSessionKnown(false)
    try {
      const response = await fetch('/auth/session', {
        credentials: 'same-origin',
        signal: requests.current.signal,
      })
      if (!active.current || sequence !== sessionRequest.current) return
      if (response.status === 401) setSession(null)
      else {
        if (!response.ok)
          throw new Error('Could not read your current sign-in.')
        const value = (await response.json()) as WorkspaceSession
        if (!active.current || sequence !== sessionRequest.current) return
        setSession(value)
      }
      setSessionKnown(true)
      setSessionError('')
    } catch {
      if (active.current && sequence === sessionRequest.current)
        setSessionError(
          'Current sign-in unknown. Check it before setting a password.',
        )
    } finally {
      if (active.current && sequence === sessionRequest.current)
        setSessionLoading(false)
    }
  }

  useEffect(() => {
    active.current = true
    requests.current = new AbortController()
    heading.current?.focus({ preventScroll: true })
    if (token !== null) {
      setAcceptedEmail('')
      setPassword('')
      setConfirmation('')
      setUnconfirmed(false)
      setError('')
      void readPreview()
      void readSession()
    }
    return () => {
      active.current = false
      requests.current.abort()
      previewRequest.current++
      sessionRequest.current++
    }
  }, [token])

  async function logout() {
    if (
      !active.current ||
      pending.current ||
      actor.busy ||
      !sessionKnown ||
      !session
    )
      return
    if (
      useStudio.getState().dirty &&
      !window.confirm(
        t(
          'Discard unsaved draft changes and sign out to accept this invitation?',
        ),
      )
    )
      return
    pending.current = true
    sessionRequest.current++
    await actor.task(async () => {
      try {
        await send('/auth/logout', {}, session.csrfToken)
        if (!active.current) return
        setSession(null)
        setSessionKnown(true)
        setSessionError('')
        onSignedOut()
      } catch {
        if (!active.current) return
        setSessionKnown(false)
        setSessionError(
          'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.',
        )
      }
    })
    pending.current = false
  }

  async function accept() {
    if (
      !active.current ||
      pending.current ||
      actor.busy ||
      !preview ||
      !sessionKnown ||
      session ||
      unconfirmed
    )
      return
    if (password !== confirmation) {
      setError('Passwords must match.')
      return
    }
    pending.current = true
    setError('')
    await actor.task(async () => {
      try {
        const result = await send<{ ok: true; email: string }>(
          '/auth/invitations/accept',
          { token, password },
        )
        if (!active.current) return
        setAcceptedEmail(result.email)
        setPassword('')
        setConfirmation('')
        setPreview(null)
        onConsumed()
      } catch (reason) {
        if (!active.current) return
        setPassword('')
        setConfirmation('')
        setUnconfirmed(true)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not confirm password setup.'} No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.`,
        )
      }
    })
    pending.current = false
  }

  const disabled = actor.busy
  const recoveryGuidance =
    'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.'
  const errorContent = error.endsWith(` ${recoveryGuidance}`)
    ? `${t(error.slice(0, -recoveryGuidance.length - 1))} ${t(recoveryGuidance)}`
    : t(error)

  return (
    <main className="welcome">
      <section className="welcome-story">
        <a
          className="brand"
          href="/"
          aria-label={t('Besh home')}
          onClick={(event) => {
            event.preventDefault()
            if (!disabled && sessionKnown) session ? onReturn() : onSignIn()
          }}
        >
          <span className="brand-icon">b</span>besh
          <span className="brand-period">.</span>
        </a>
        <div className="welcome-copy">
          <span className="eyebrow">{t('YOUR WORKSPACE INVITATION')}</span>
          <h1>{t('Your workspace invite.')}</h1>
          <p>
            {t(
              'Set up email sign-in for your existing member. Your role and API access do not change.',
            )}
          </p>
        </div>
      </section>
      <section className="welcome-form">
        <div className="welcome-controls">
          <LanguageControl disabled={actor.busy} />
          <ThemeControl />
        </div>
        <div className="setup-card form-stack">
          <h1 ref={heading} tabIndex={-1}>
            {t('Accept invitation')}
          </h1>
          {entryError ? (
            <p className="form-error" role="alert">
              {t(entryError)}
            </p>
          ) : null}
          {acceptedEmail ? (
            <>
              <h2>{t('Password set')}</h2>
              <p>
                {t(
                  'Email sign-in is ready for {email}. You are not signed in yet.',
                  { email: acceptedEmail },
                )}
              </p>
              <Button disabled={disabled} onClick={onSignIn}>
                {t('Sign in')}
              </Button>
            </>
          ) : (
            <>
              {previewLoading ? (
                <p role="status">{t('Reading invitation…')}</p>
              ) : null}
              {previewError ? (
                <p className="form-error" role="alert">
                  {t(previewError)}
                </p>
              ) : null}
              {!preview && !previewLoading && !unconfirmed ? (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void readPreview()}
                >
                  {t('Check invitation')}
                </Button>
              ) : null}
              {preview ? (
                <>
                  <h2>{preview.workspaceName}</h2>
                  <p>
                    {preview.memberName} · {preview.email}
                  </p>
                  <p>
                    {preview.roleName} ·{' '}
                    {t(
                      preview.accessMode === 'selected'
                        ? 'Selected APIs'
                        : 'All APIs',
                    )}
                  </p>
                  <p>
                    {t('Expires {date}.', {
                      date: new Date(preview.expiresAt).toLocaleString(
                        language === 'en' ? undefined : language,
                      ),
                    })}
                  </p>
                </>
              ) : null}
              <section className="form-stack" aria-label={t('Current sign-in')}>
                {sessionLoading ? (
                  <p role="status">{t('Checking current sign-in…')}</p>
                ) : sessionKnown && session ? (
                  <>
                    <p>
                      {t(
                        'You are signed in as {name}. Sign out explicitly before setting this member’s password.',
                        { name: session.member.name },
                      )}
                    </p>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() => void logout()}
                    >
                      {t('Sign out to accept invitation')}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={disabled}
                      onClick={onReturn}
                    >
                      {t('Return to workspace')}
                    </Button>
                  </>
                ) : sessionKnown ? (
                  <p>{t('No workspace sign-in is active.')}</p>
                ) : null}
                {sessionError ? (
                  <p className="form-error" role="alert">
                    {t(sessionError)}
                  </p>
                ) : null}
                {!sessionKnown && !sessionLoading ? (
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() => void readSession()}
                  >
                    {t('Check current sign-in')}
                  </Button>
                ) : null}
              </section>
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault()
                  void accept()
                }}
              >
                <label>
                  {t('New password')}
                  <Input
                    aria-label={t('Invitation password')}
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    disabled={
                      disabled ||
                      !sessionKnown ||
                      !!session ||
                      !preview ||
                      unconfirmed
                    }
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <label>
                  {t('Confirm password')}
                  <Input
                    aria-label={t('Confirm invitation password')}
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={confirmation}
                    disabled={
                      disabled ||
                      !sessionKnown ||
                      !!session ||
                      !preview ||
                      unconfirmed
                    }
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
                <small>
                  {t(
                    'Use 12 to 128 characters. Your existing workspace key still works.',
                  )}
                </small>
                {error ? (
                  <p className="form-error" role="alert">
                    {errorContent}
                  </p>
                ) : null}
                <Button
                  disabled={
                    disabled ||
                    !sessionKnown ||
                    !!session ||
                    !preview ||
                    unconfirmed
                  }
                >
                  {t('Set password')}
                </Button>
              </form>
              {sessionKnown && !session ? (
                <Button variant="ghost" disabled={disabled} onClick={onSignIn}>
                  {t('Leave invitation and sign in')}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
