import { useEffect, useState } from 'react'
import { ArrowUpRight, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Checkbox } from './components/ui/checkbox'
import { Badge } from './components/ui/badge'
import { api } from './lib/api'
import { useStudio } from './store'
import type { UpdateState } from '../src/updates/model'

const labels = {
  available: 'Update available',
  current: 'No newer release found',
  'no-releases': 'No matching releases found',
  error: 'Release check failed',
}

export function Updates() {
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

  if (!allowed) return <p>Owner access required to manage Besh updates.</p>

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
            : 'Could not load update information.',
        )
      }
    })
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">YOUR BESH INSTALLATION</div>
          <h1>Besh updates</h1>
          <p>Check public GitHub releases when you are ready.</p>
        </div>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (
              dirty &&
              !confirm('Discard unsaved update settings and refresh?')
            )
              return
            perform(async () => {
              apply(await api<UpdateState>('/api/updates'))
            })
          }}
        >
          <RefreshCw /> Refresh update settings
        </Button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p role="status">Loading update settings…</p> : null}
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
                'Update settings saved. Check releases to get a fresh result.',
              )
            })
          }}
        >
          <h2>Release settings</h2>
          <label htmlFor="update-repository">GitHub repository</label>
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
            Use a public repository URL. Private repositories and access tokens
            are not supported.
          </small>
          <label className="flex items-center gap-3">
            <Checkbox
              checked={includePrereleases}
              onCheckedChange={(checked) =>
                setIncludePrereleases(checked === true)
              }
              disabled={disabled || !state}
              aria-label="Include preview releases"
            />
            Include preview releases
          </label>
          <small>
            Show alpha, beta and other prereleases alongside stable versions.
          </small>
          <Button disabled={disabled || !state || !dirty}>
            Save update settings
          </Button>
          {dirty ? <p>Save your changes before checking releases.</p> : null}
        </form>
        <section
          className="load-test-card form-stack min-w-0"
          aria-label="Release status"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2>Release status</h2>
            {state ? (
              <Badge variant="secondary">
                Installed {state.currentVersion}
              </Badge>
            ) : null}
          </div>
          <h3>
            {state?.lastCheck
              ? labels[state.lastCheck.status]
              : 'No release check yet'}
          </h3>
          {state?.lastCheck ? (
            <>
              <p>
                Last checked{' '}
                {new Date(state.lastCheck.checkedAt).toLocaleString()}
              </p>
              {state.lastCheck.error ? (
                <p className="form-error">{state.lastCheck.error}</p>
              ) : null}
              {state.lastCheck.release ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{state.lastCheck.release.version}</strong>
                    {state.lastCheck.release.prerelease ? (
                      <Badge variant="outline">Preview release</Badge>
                    ) : null}
                  </div>
                  <p className="break-words">{state.lastCheck.release.name}</p>
                  <Button variant="outline" asChild>
                    <a
                      href={state.lastCheck.release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View GitHub release <ArrowUpRight />
                    </a>
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <p>
              A check runs only when you choose it. Opening this page uses saved
              information.
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
                message('Release check finished. Review the result below.')
              })
            }}
          >
            <RefreshCw /> Check releases
          </Button>
          <small>
            One check per minute. Checks inspect the first 20 published GitHub
            releases.
          </small>
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-1 shrink-0" size={16} />
            <span>
              This page reports versions. It does not install updates or verify
              release compatibility. Review release notes and back up data
              before upgrading.
            </span>
          </p>
        </section>
      </div>
    </>
  )
}
