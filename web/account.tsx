import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Badge } from './components/ui/badge'
import { api, type SessionRecord } from './lib/api'
import { useStudio } from './store'
import { translateMessage, useDateTime, useTranslation } from './i18n'

export function Account() {
  const { t } = useTranslation()
  const dateTime = useDateTime()
  const { member, expiresAt, busy, task, message, clearSession } = useStudio()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [proof, setProof] = useState<'key' | 'password'>('key')
  const [credential, setCredential] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')

  async function refresh() {
    setSessions(await api<SessionRecord[]>('/api/sessions'))
    setError('')
  }

  useEffect(() => {
    let active = true
    Promise.all([
      api<{ email: string | null }>('/api/account'),
      api<SessionRecord[]>('/api/sessions'),
    ])
      .then(([account, records]) => {
        if (!active) return
        setEmail(account.email ?? '')
        setSessions(records)
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
  }, [])

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">{t('YOUR WORKSPACE ACCESS')}</div>
          <h1>{t('Account & sessions')}</h1>
          <p>{t('Manage your email sign-in and active browser sessions.')}</p>
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p>{t('Loading your account…')}</p> : null}
      <form
        className="account-form form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          setSaveError('')
          void task(async () => {
            try {
              const account = await api<{ email: string }>(
                '/api/account',
                '',
                'PUT',
                {
                  email: email.trim(),
                  password,
                  ...(proof === 'key'
                    ? { token: credential.trim() }
                    : { currentPassword: credential }),
                },
              )
              setEmail(account.email)
              setPassword('')
              setCredential('')
              await refresh()
              message(
                translateMessage(
                  'Sign-in details saved. Other browser sessions were revoked.',
                ),
              )
            } catch (reason) {
              setSaveError(
                reason instanceof Error
                  ? reason.message
                  : translateMessage('Could not save sign-in details.'),
              )
              throw reason
            }
          })
        }}
      >
        <h2>{t('Email & password')}</h2>
        <p>
          {t(
            'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.',
          )}
        </p>
        <label htmlFor="account-email">{t('Account email')}</label>
        <Input
          id="account-email"
          type="email"
          autoComplete="username"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy || loading}
          required
        />
        <label htmlFor="account-password">{t('New password')}</label>
        <Input
          id="account-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy || loading}
          required
        />
        <small>{t('Use 12 to 128 characters.')}</small>
        <label htmlFor="account-proof">{t('Confirm your identity')}</label>
        <Select
          id="account-proof"
          label={t('Confirm your identity')}
          value={proof}
          disabled={busy || loading}
          onValueChange={(value) => {
            setProof(value as 'key' | 'password')
            setCredential('')
          }}
          options={[
            { value: 'key', label: t('Workspace key') },
            { value: 'password', label: t('Current password') },
          ]}
        />
        <label htmlFor="account-credential">
          {t(proof === 'key' ? 'Your workspace key' : 'Current password')}
        </label>
        <Input
          id="account-credential"
          type="password"
          autoComplete={proof === 'key' ? 'off' : 'current-password'}
          value={credential}
          onChange={(event) => setCredential(event.target.value)}
          disabled={busy || loading}
          required
        />
        {saveError ? (
          <p id="account-save-error" className="form-error" role="alert">
            {saveError}
          </p>
        ) : null}
        <Button disabled={busy || loading}>{t('Save sign-in details')}</Button>
      </form>
      <div className="page-title session-heading">
        <div>
          <h2>{t('Active sessions')}</h2>
          <p>
            {t(
              member?.role === 'owner'
                ? 'Owners can revoke sessions across this workspace.'
                : 'Only your own active sessions appear here.',
            )}
          </p>
          {expiresAt ? (
            <p>
              <ShieldCheck size={14} />{' '}
              {t('Session expires {date}.', { date: dateTime(expiresAt) })}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => void task(refresh)}
        >
          <RefreshCw />
          {t('Refresh sessions')}
        </Button>
      </div>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>{t('Member')}</th>
              <th>{t('Device')}</th>
              <th>{t('Last active')}</th>
              <th>{t('Expires')}</th>
              <th>{t('Access')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.memberName}</td>
                <td>
                  {session.current ? (
                    <Badge variant="secondary">{t('This device')}</Badge>
                  ) : (
                    t('Other browser session')
                  )}
                </td>
                <td>{dateTime(session.lastSeenAt)}</td>
                <td>{dateTime(session.expiresAt)}</td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={t(
                      session.current
                        ? 'Revoke session for {name} on this device'
                        : 'Revoke session for {name}',
                      { name: session.memberName },
                    )}
                    onClick={() => {
                      if (
                        !window.confirm(
                          t(
                            session.current
                              ? 'Revoke this session and sign out?'
                              : 'Revoke this browser session for {name}?',
                            { name: session.memberName },
                          ),
                        )
                      )
                        return
                      void task(async () => {
                        await api(`/api/sessions/${session.id}`, '', 'DELETE')
                        if (session.current)
                          clearSession(
                            translateMessage(
                              'This session was revoked. Sign in again.',
                            ),
                          )
                        else {
                          await refresh()
                          message(translateMessage('Browser session revoked.'))
                        }
                      })
                    }}
                  >
                    <Trash2 />
                    {t('Revoke')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sessions.length && !loading ? (
          <p className="table-empty">{t('No active sessions.')}</p>
        ) : null}
      </div>
    </>
  )
}
