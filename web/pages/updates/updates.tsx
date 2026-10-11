import { useEffect, useState } from 'react'
import { ArrowUpRight, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { Badge } from '../../components/ui/badge'
import { api } from '../../lib/api'
import { useStudio } from '../../stores/studio-store'
import type { UpdateState } from '../../../src/updates/model'
import { translateMessage, useDateTime, useTranslation } from '../../i18n'

const labels = {
  available: 'Update available',
  current: 'No newer release found',
  'no-releases': 'No matching releases found',
  error: 'Release check failed',
}

export function Updates() {
  const { t } = useTranslation()
  const dateTime = useDateTime()
  const { member, busy, task, message } = useStudio()
  const [state, setState] = useState<UpdateState | null>(null)
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [includePrereleases, setIncludePrereleases] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const allowed = member?.role === 'owner'

  function apply(next: UpdateState) {
    setState(next)
    setRepositoryUrl(next.settings.repositoryUrl)
    setIncludePrereleases(next.settings.includePrereleases)
    setError('')
  }

  useEffect(() => {
    if (!allowed) {
      setLoading(false)
      return
    }
    let active = true
    api<UpdateState>('/api/updates')
      .then((next) => {
        if (active) apply(next)
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
  }, [allowed])

  if (!allowed)
    return <p>{t('Owner access required to manage Besh updates.')}</p>

  const dirty =
    !!state &&
    (repositoryUrl.trim() !== state.settings.repositoryUrl ||
      includePrereleases !== state.settings.includePrereleases)
  const disabled = busy || loading

  function perform(action: () => Promise<void>) {
    setError('')
    void task(async () => {
      try {
        await action()
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : translateMessage('Could not load update information.'),
        )
      }
    })
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">{t('YOUR BESH INSTALLATION')}</div>
          <h1>{t('Besh updates')}</h1>
          <p>{t('Check public GitHub releases when you are ready.')}</p>
        </div>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (
              dirty &&
              !confirm(t('Discard unsaved update settings and refresh?'))
            )
              return
            perform(async () => {
              apply(await api<UpdateState>('/api/updates'))
            })
          }}
        >
          <RefreshCw /> {t('Refresh update settings')}
        </Button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p role="status">{t('Loading update settings…')}</p> : null}
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <form
          className="load-test-card form-stack min-w-0"
          onSubmit={(event) => {
            event.preventDefault()
            if (!state) return
            perform(async () => {
              apply(
                await api<UpdateState>('/api/updates', '', 'PUT', {
                  repositoryUrl: repositoryUrl.trim(),
                  includePrereleases,
                  revision: state.settings.revision,
                }),
              )
              message(
                translateMessage(
                  'Update settings saved. Check releases to get a fresh result.',
                ),
              )
            })
          }}
        >
          <h2>{t('Release settings')}</h2>
          <label htmlFor="update-repository">{t('GitHub repository')}</label>
          <Input
            id="update-repository"
            type="url"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            disabled={disabled || !state}
            maxLength={300}
            required
            placeholder="https://github.com/owner/repository"
          />
          <small>
            {t(
              'Use a public repository URL. Private repositories and access tokens are not supported.',
            )}
          </small>
          <label className="flex items-center gap-3">
            <Checkbox
              checked={includePrereleases}
              onCheckedChange={(checked) =>
                setIncludePrereleases(checked === true)
              }
              disabled={disabled || !state}
              aria-label={t('Include preview releases')}
            />
            {t('Include preview releases')}
          </label>
          <small>
            {t(
              'Show alpha, beta and other prereleases alongside stable versions.',
            )}
          </small>
          <Button disabled={disabled || !state || !dirty}>
            {t('Save update settings')}
          </Button>
          {dirty ? (
            <p>{t('Save your changes before checking releases.')}</p>
          ) : null}
        </form>
        <section
          className="load-test-card form-stack min-w-0"
          aria-label={t('Release status')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2>{t('Release status')}</h2>
            {state ? (
              <Badge variant="secondary">
                {t('Installed {version}', { version: state.currentVersion })}
              </Badge>
            ) : null}
          </div>
          <h3>
            {t(
              state?.lastCheck
                ? labels[state.lastCheck.status]
                : 'No release check yet',
            )}
          </h3>
          {state?.lastCheck ? (
            <>
              <p>
                {t('Last checked {date}', {
                  date: dateTime(state.lastCheck.checkedAt),
                })}
              </p>
              {state.lastCheck.error ? (
                <p className="form-error">{state.lastCheck.error}</p>
              ) : null}
              {state.lastCheck.release ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{state.lastCheck.release.version}</strong>
                    {state.lastCheck.release.prerelease ? (
                      <Badge variant="outline">{t('Preview release')}</Badge>
                    ) : null}
                  </div>
                  <p className="break-words">{state.lastCheck.release.name}</p>
                  <Button variant="outline" asChild>
                    <a
                      href={state.lastCheck.release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('View GitHub release')} <ArrowUpRight />
                    </a>
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <p>
              {t(
                'A check runs only when you choose it. Opening this page uses saved information.',
              )}
            </p>
          )}
          <Button
            disabled={disabled || !state || dirty}
            onClick={() => {
              if (!state) return
              perform(async () => {
                apply(
                  await api<UpdateState>('/api/updates/check', '', 'POST', {
                    revision: state.settings.revision,
                  }),
                )
                message(
                  translateMessage(
                    'Release check finished. Review the result below.',
                  ),
                )
              })
            }}
          >
            <RefreshCw /> {t('Check releases')}
          </Button>
          <small>
            {t(
              'One check per minute. Checks inspect the first 20 published GitHub releases.',
            )}
          </small>
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-1 shrink-0" size={16} />
            <span>
              {t(
                'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.',
              )}
            </span>
          </p>
        </section>
      </div>
    </>
  )
}
