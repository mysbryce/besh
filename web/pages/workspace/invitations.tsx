import { useTranslation } from '../../i18n'
import { useEffect, useRef, useState } from 'react'
import { Copy, RefreshCw, Trash2 } from 'lucide-react'
import type { Invitation } from '../../../src/auth/invitations'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { api, ApiError } from '../../lib/api'
import type { Member } from '../../types/api'
import { useStudio } from '../../stores/studio-store'

export function Invitations({
  memberId,
  onClose,
}: {
  memberId: string
  onClose: () => void
}) {
  const { language, t } = useTranslation()
  const actor = useStudio()
  const [members, setMembers] = useState<Member[]>([])
  const [records, setRecords] = useState<Invitation[]>([])
  const [selectedId, setSelectedId] = useState(memberId)
  const [email, setEmail] = useState('')
  const [issued, setIssued] = useState<(Invitation & { link: string }) | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [known, setKnown] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  const request = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)

  function current() {
    const state = useStudio.getState()
    return (
      active.current &&
      state.member?.role === 'owner' &&
      state.member.id === actor.member?.id &&
      state.sessionId === actor.sessionId &&
      state.token === actor.token
    )
  }

  async function read() {
    if (!current() || pending.current) return
    const sequence = ++request.current
    setLoading(true)
    setKnown(false)
    try {
      const [people, invitations] = await Promise.all([
        api<Member[]>('/api/members', actor.token),
        api<Invitation[]>('/api/invitations', actor.token),
      ])
      if (!current() || sequence !== request.current) return
      setMembers(people)
      setRecords(invitations)
      setKnown(true)
      setError('')
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          `${reason instanceof Error ? reason.message : 'Could not read invitations.'} Refresh invitations before changing a link.`,
        )
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }

  useEffect(() => {
    active.current = true
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    void read()
    return () => {
      active.current = false
      request.current++
    }
  }, [
    memberId,
    actor.member?.id,
    actor.member?.role,
    actor.sessionId,
    actor.token,
  ])

  const eligible = members.filter(
    (person) => person.role !== 'owner' && person.hasAccount === false,
  )
  const selected = eligible.find((person) => person.id === selectedId)
  const disabled = actor.busy || loading || !known || !!issued
  const issuedActive =
    !!issued &&
    known &&
    records.some(
      (record) =>
        record.id === issued.id && Date.parse(record.expiresAt) > Date.now(),
    )
  const errorGuidance = [
    'Refresh invitations before changing a link.',
    'Refresh invitations before trying again.',
  ].find((guidance) => error.endsWith(` ${guidance}`))
  const errorContent = errorGuidance
    ? `${t(error.slice(0, -errorGuidance.length - 1))} ${t(errorGuidance)}`
    : t(error)

  async function issue() {
    if (!current() || pending.current || disabled || !selected) return
    pending.current = true
    request.current++
    await actor.task(async () => {
      try {
        const receipt = await api<Invitation & { token: string }>(
          '/api/invitations',
          actor.token,
          'POST',
          { memberId: selected.id, email: email.trim() },
        )
        if (!current()) return
        const { token, ...metadata } = receipt
        const link = new URL('/', location.origin)
        link.hash = `invite=${token}`
        setIssued({ ...metadata, link: link.href })
        setRecords((items) => [
          metadata,
          ...items.filter((item) => item.memberId !== metadata.memberId),
        ])
        setError('')
        actor.message('Invitation created. Copy the link; it is shown once.')
      } catch (reason) {
        if (!current()) return
        setKnown(false)
        setError(
          reason instanceof ApiError && reason.status < 500
            ? `${reason.message} Refresh invitations before trying again.`
            : 'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.',
        )
      }
    })
    pending.current = false
  }

  async function revoke(record: Invitation) {
    if (!current() || pending.current || disabled) return
    pending.current = true
    request.current++
    await actor.task(async () => {
      try {
        await api(`/api/invitations/${record.id}`, actor.token, 'DELETE')
        if (!current()) return
        setRecords((items) => items.filter((item) => item.id !== record.id))
        setError('')
        actor.message(
          'Invitation revoked. That link can no longer set a password.',
        )
      } catch (reason) {
        if (!current()) return
        setKnown(false)
        setError(
          'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.',
        )
      }
    })
    pending.current = false
  }

  return (
    <section
      className="load-test-card form-stack"
      aria-label={t('Sign-in invitation')}
    >
      <h2 ref={heading} tabIndex={-1}>
        {t('Invitations')}
      </h2>
      <p>
        {t(
          'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.',
        )}
      </p>
      <Button
        variant="outline"
        disabled={actor.busy || loading}
        onClick={() => void read()}
      >
        <RefreshCw />
        {t('Refresh invitations')}
      </Button>
      {loading ? <p role="status">{t('Loading invitations…')}</p> : null}
      {!known && !loading ? (
        <p>{t('Current invitations unknown. Refresh needed.')}</p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {errorContent}
        </p>
      ) : null}
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          void issue()
        }}
      >
        <label>
          {t('Existing member')}
          <Select
            label={t('Invitation member')}
            value={selectedId}
            disabled={disabled}
            onValueChange={setSelectedId}
            options={eligible.map((person) => ({
              value: person.id,
              label: person.name,
            }))}
          />
        </label>
        <label>
          {t('Invitation email')}
          <Input
            aria-label={t('Invitation email')}
            type="email"
            autoComplete="off"
            maxLength={254}
            required
            value={email}
            disabled={disabled}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p>{t('Expires in 24 hours. Besh does not send email.')}</p>
        <p>
          {t(
            'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.',
          )}
        </p>
        <Button disabled={disabled || !selected}>
          {t('Create invitation link')}
        </Button>
      </form>
      {issued ? (
        <div className="issued-token form-stack">
          <strong>{t('Save this invitation link')}</strong>
          <p>
            {issued.memberName} · {issued.email}
          </p>
          <p>
            {t('Expires {date}.', {
              date: new Date(issued.expiresAt).toLocaleString(
                language === 'en' ? undefined : language,
              ),
            })}
          </p>
          <p>
            {t(
              !known
                ? 'Link status unconfirmed. Refresh invitations before sharing it.'
                : issuedActive
                  ? 'Current pending invitation.'
                  : 'This invitation is no longer active. Its link cannot set a password.',
            )}
          </p>
          <Input
            aria-label={t('Invitation link')}
            data-private="true"
            readOnly
            value={issued.link}
          />
          <Button
            variant="outline"
            disabled={actor.busy || loading || !issuedActive}
            onClick={() => {
              if (
                !current() ||
                !known ||
                !records.some(
                  (record) =>
                    record.id === issued.id &&
                    Date.parse(record.expiresAt) > Date.now(),
                )
              )
                return
              void actor.task(async () => {
                await navigator.clipboard.writeText(issued.link)
                if (current()) actor.message('Invitation link copied.')
              })
            }}
          >
            <Copy />
            {t('Copy invitation link')}
          </Button>
          <Button
            variant="ghost"
            disabled={actor.busy}
            onClick={() => setIssued(null)}
          >
            {t('I saved the link')}
          </Button>
        </div>
      ) : null}
      <h3>{t('Pending invitations')}</h3>
      {!known ? (
        <p>{t('Refresh to read current pending invitations.')}</p>
      ) : records.length ? (
        records.map((record) => (
          <article className="load-test-card form-stack" key={record.id}>
            <strong>{record.memberName}</strong>
            <p>{record.email}</p>
            <p>
              {t('Expires {date}.', {
                date: new Date(record.expiresAt).toLocaleString(
                  language === 'en' ? undefined : language,
                ),
              })}
            </p>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => void revoke(record)}
            >
              <Trash2 />
              {t('Revoke invitation')}
            </Button>
          </article>
        ))
      ) : (
        <p>{t('No pending invitations.')}</p>
      )}
      <Button variant="ghost" disabled={actor.busy} onClick={onClose}>
        {t('Close invitations')}
      </Button>
    </section>
  )
}
