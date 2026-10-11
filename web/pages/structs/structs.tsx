import { useEffect, useRef, useState } from 'react'
import { FilePlus2, RefreshCw, Save } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { api, ApiError } from '../../lib/api'
import type { StructDraft, StructSummary } from '../../types/api'
import { useStudio } from '../../stores/studio-store'
import { useTranslation } from '../../i18n'
import { StructFields } from './struct-fields'
import {
  definitionError,
  savedFields,
  structLimits,
  useStructDraft,
} from '../../stores/struct-store'

export function Structs() {
  const state = useStudio()
  const draft = useStructDraft()
  const { t } = useTranslation()
  const [models, setModels] = useState<StructSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const mounted = useRef(false)
  const memberId = state.member?.id
  const role = state.member?.role
  const sessionId = state.sessionId
  const token = state.token

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (role !== 'owner') return

    let active = true
    setLoading(true)
    setModels([])
    setError('')
    void api<StructSummary[]>('/api/structs', token)
      .then((value) => {
        if (active && ownsReply()) setModels(value)
      })
      .catch((reason: unknown) => {
        if (active && ownsReply())
          reportError(reason, 'Could not load content models.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [memberId, role, sessionId, token])

  function ownsReply(epoch?: number) {
    const current = useStudio.getState()

    return (
      mounted.current &&
      current.member?.role === 'owner' &&
      current.member.id === memberId &&
      current.sessionId === sessionId &&
      current.token === token &&
      (epoch === undefined || useStructDraft.getState().epoch === epoch)
    )
  }

  function reportError(reason: unknown, fallback: string) {
    const message = reason instanceof Error ? reason.message : fallback

    setError(message)
    state.message(message, true)
  }

  function discard() {
    return (
      !useStructDraft.getState().dirty ||
      window.confirm(t('Discard unsaved content model changes?'))
    )
  }

  function newModel() {
    if (state.busy || loading || !discard()) return

    draft.reset()
    setError('')
    setConflict(false)
    state.message('New model')
  }

  function openModel(id: string) {
    if (state.busy || loading || !discard()) return

    const epoch = useStructDraft.getState().epoch
    setError('')
    void state.task(async () => {
      try {
        const saved = await api<StructDraft>(
          `/api/structs/${encodeURIComponent(id)}`,
          token,
        )
        if (!ownsReply(epoch)) return

        draft.reset(saved)
        setConflict(false)
        state.message('Draft loaded.')
      } catch (reason) {
        if (!ownsReply(epoch)) return

        reportError(reason, 'Could not load content model.')
      }
    })
  }

  function refreshModels() {
    if (state.busy || loading) return

    const epoch = useStructDraft.getState().epoch
    if (!conflict) setError('')
    void state.task(async () => {
      try {
        const value = await api<StructSummary[]>('/api/structs', token)
        if (ownsReply(epoch)) {
          setModels(value)
          state.message(conflict ? error : 'Workspace ready.', conflict)
        }
      } catch (reason) {
        if (ownsReply(epoch))
          reportError(reason, 'Could not load content models.')
      }
    })
  }

  function saveDraft() {
    const current = useStructDraft.getState()
    if (
      state.busy ||
      loading ||
      !current.dirty ||
      definitionError(current.name, current.fields)
    )
      return

    const epoch = current.epoch
    const definition = {
      name: current.name,
      fields: savedFields(current.fields),
    }
    const path = current.id
      ? `/api/structs/${encodeURIComponent(current.id)}`
      : '/api/structs'
    const body = current.id
      ? { version: current.version, ...definition }
      : definition
    setError('')
    setConflict(false)
    void state.task(async () => {
      try {
        const saved = await api<StructDraft>(
          path,
          token,
          current.id ? 'PUT' : 'POST',
          body,
        )
        if (!ownsReply(epoch)) return

        draft.reset(saved)
        const { fields: _fields, ...summary } = saved
        setModels((catalog) =>
          catalog.some((model) => model.id === saved.id)
            ? catalog.map((model) => (model.id === saved.id ? summary : model))
            : [...catalog, summary],
        )
        state.message('Content model draft saved.')
      } catch (reason) {
        if (!ownsReply(epoch)) return

        setConflict(
          reason instanceof ApiError && reason.status === 409 && !!current.id,
        )
        reportError(reason, 'Could not save content model.')
      }
    })
  }

  const disabled = state.busy || loading
  const validation = definitionError(draft.name, draft.fields)

  return (
    <div className="struct-editor">
      <div className="page-title">
        <div>
          <h1>{t('Content models')}</h1>
          <p>
            {t(
              'Define record fields with forms. This draft does not publish content or an API.',
            )}
          </p>
        </div>
      </div>
      <section className="struct-catalog">
        <label>
          {t('Choose a model')}
          <Select
            label={t('Choose a model')}
            value={draft.id ?? ''}
            placeholder={t('Choose a model')}
            options={models.map((model) => ({
              value: model.id,
              label: model.name,
            }))}
            disabled={disabled || !models.length}
            onValueChange={openModel}
          />
        </label>
        <div className="struct-actions">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={newModel}
          >
            <FilePlus2 size={16} />
            {t('New model')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={refreshModels}
          >
            <RefreshCw size={16} />
            {t('Refresh')}
          </Button>
        </div>
        {loading ? (
          <p role="status" className="field-help">
            {t('Loading content models…')}
          </p>
        ) : !models.length ? (
          <p className="field-help">{t('No content models yet')}</p>
        ) : null}
      </section>
      <form
        className="struct-draft"
        onSubmit={(event) => {
          event.preventDefault()
          saveDraft()
        }}
      >
        <div className="struct-draft-heading">
          <h2>{t('Model draft')}</h2>
          <div className="struct-actions">
            {draft.version !== null ? (
              <Badge variant="outline">
                {t('Draft revision {version}', { version: draft.version })}
              </Badge>
            ) : null}
            {draft.dirty ? (
              <Badge variant="secondary">{t('Unsaved changes')}</Badge>
            ) : null}
          </div>
        </div>
        <label className="struct-name">
          {t('Model name')}
          <Input
            aria-label={t('Model name')}
            value={draft.name}
            maxLength={80}
            disabled={disabled}
            onChange={(event) => draft.edit({ name: event.target.value })}
          />
        </label>
        <p className="field-help">
          {t(
            'Keys start with a lowercase letter and use lowercase letters, numbers, or underscores. Reserved names are not allowed.',
          )}
        </p>
        <StructFields
          fields={draft.fields}
          disabled={disabled}
          onChange={(fields) => draft.edit({ fields })}
        />
        <p className="field-help">{t(structLimits)}</p>
        {draft.dirty && validation ? (
          <p className="field-help">{t(validation)}</p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        ) : null}
        <div className="struct-actions">
          <Button
            type="submit"
            disabled={disabled || !draft.dirty || !!validation}
          >
            <Save size={16} />
            {t('Save draft')}
          </Button>
          {conflict && draft.id ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => openModel(draft.id!)}
            >
              {t('Reload saved version')}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
