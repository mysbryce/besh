import { useEffect, useId, useRef, useState } from 'react'
import { FilePlus2, RefreshCw, Save } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { api, ApiError } from '../../lib/api'
import type {
  Collection,
  CollectionSummary,
  StructDraft,
  StructSummary,
} from '../../types/api'
import type { StructField, StructSchema } from '../../../src/structs/model'
import { useStudio } from '../../stores/studio-store'
import { useCollectionDraft } from '../../stores/collection-store'
import { useContentEntryDraft } from '../../stores/content-entry-store'
import { useContentRendererDraft } from '../../stores/content-renderer-store'
import { ContentEntries } from './content-entries'
import { ContentRendererSettings } from './content-renderer'
import { useTranslation } from '../../i18n'

const typeLabels = {
  richText: 'Rich text',
  text: 'Text',
  number: 'Number',
  boolean: 'True or false',
  object: 'Group',
  array: 'List',
  select: 'Choice',
} as const

export function Collections() {
  const state = useStudio()
  const draft = useCollectionDraft()
  const { t } = useTranslation()
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [models, setModels] = useState<StructSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewRequired, setReviewRequired] = useState(false)
  const [modelExpanded, setModelExpanded] = useState(false)
  const modelFieldsId = useId()
  const mounted = useRef(false)
  const operation = useRef(0)
  const memberId = state.member?.id
  const role = state.member?.role
  const sessionId = state.sessionId
  const token = state.token
  const selectedCollectionId = draft.collection?.id

  useEffect(() => {
    setModelExpanded(false)
  }, [selectedCollectionId, memberId, role, sessionId, token])

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      operation.current += 1
    }
  }, [])

  useEffect(() => {
    if (role !== 'owner') return

    let active = true
    const request = ++operation.current

    setLoading(true)
    setCollections([])
    setModels([])
    setError('')

    void Promise.all([
      api<CollectionSummary[]>('/api/collections', token),
      api<StructSummary[]>('/api/structs', token),
    ])
      .then(([catalog, savedModels]) => {
        if (!active || !ownsReply(request)) return

        setCollections(catalog)
        setModels(savedModels)
      })
      .catch((reason: unknown) => {
        if (active && ownsReply(request))
          reportError(reason, 'Could not load collections.')
      })
      .finally(() => {
        if (active && ownsReply(request)) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [memberId, role, sessionId, token])

  function ownsReply(request?: number, epoch?: number) {
    const current = useStudio.getState()

    return (
      mounted.current &&
      current.member?.role === 'owner' &&
      current.member.id === memberId &&
      current.sessionId === sessionId &&
      current.token === token &&
      (request === undefined || operation.current === request) &&
      (epoch === undefined || useCollectionDraft.getState().epoch === epoch)
    )
  }

  function reportError(reason: unknown, fallback: string) {
    const message = reason instanceof Error ? reason.message : fallback

    setError(message)
    state.message(message, true)
  }

  function discard() {
    return (
      (!useCollectionDraft.getState().dirty ||
        window.confirm(t('Discard unsaved collection changes?'))) &&
      (!useContentEntryDraft.getState().dirty ||
        window.confirm(t('Discard unsaved entry changes?'))) &&
      (!useContentRendererDraft.getState().dirty ||
        window.confirm(t('Discard unsaved HTML settings?')))
    )
  }

  function newCollection() {
    if (!ownsReply() || useStudio.getState().busy || loading || !discard())
      return

    operation.current += 1
    draft.reset()
    useContentEntryDraft.getState().reset()
    useContentRendererDraft.getState().reset()
    setError('')
    setReviewRequired(false)
    state.message('New collection')
  }

  function reviewModel(id: string) {
    if (!ownsReply() || useStudio.getState().busy || loading) return

    draft.chooseModel(id)
    const epoch = useCollectionDraft.getState().epoch
    const request = ++operation.current

    setError('')
    setReviewRequired(false)

    void state.task(async () => {
      try {
        const model = await api<StructDraft>(
          `/api/structs/${encodeURIComponent(id)}`,
          token,
        )
        if (!ownsReply(request, epoch)) return

        draft.review(model)
        state.message('Content model ready for review.')
      } catch (reason) {
        if (ownsReply(request, epoch))
          reportError(reason, 'Could not load content model.')
      }
    })
  }

  function openCollection(id: string) {
    if (!ownsReply() || useStudio.getState().busy || loading || !discard())
      return

    const epoch = useCollectionDraft.getState().epoch
    const request = ++operation.current

    setError('')

    void state.task(async () => {
      try {
        const saved = await api<Collection>(
          `/api/collections/${encodeURIComponent(id)}`,
          token,
        )
        if (!ownsReply(request, epoch)) return

        draft.reset(saved)
        useContentEntryDraft.getState().reset(saved.id)
        useContentRendererDraft.getState().reset()
        setReviewRequired(false)
        state.message('Collection loaded.')
      } catch (reason) {
        if (ownsReply(request, epoch))
          reportError(reason, 'Could not load collection.')
      }
    })
  }

  function refreshCatalog() {
    if (!ownsReply() || useStudio.getState().busy || loading) return

    const epoch = useCollectionDraft.getState().epoch
    const request = ++operation.current

    if (!reviewRequired) setError('')

    void state.task(async () => {
      try {
        const [catalog, savedModels] = await Promise.all([
          api<CollectionSummary[]>('/api/collections', token),
          api<StructSummary[]>('/api/structs', token),
        ])
        if (!ownsReply(request, epoch)) return

        setCollections(catalog)
        setModels(savedModels)
        state.message(
          reviewRequired ? error : 'Workspace ready.',
          reviewRequired,
        )
      } catch (reason) {
        if (ownsReply(request, epoch))
          reportError(reason, 'Could not load collections.')
      }
    })
  }

  function createCollection() {
    const current = useCollectionDraft.getState()

    if (
      !ownsReply() ||
      useStudio.getState().busy ||
      loading ||
      reviewRequired ||
      current.collection ||
      !current.reviewed ||
      !current.name.trim() ||
      current.name.trim().length > 80
    )
      return

    const epoch = current.epoch
    const request = ++operation.current
    const body = {
      name: current.name,
      structId: current.reviewed.id,
      structVersion: current.reviewed.version,
    }

    setError('')

    void state.task(async () => {
      try {
        const saved = await api<Collection>(
          '/api/collections',
          token,
          'POST',
          body,
        )
        if (!ownsReply(request, epoch)) return

        const { struct, ...metadata } = saved

        draft.reset(saved)
        useContentEntryDraft.getState().reset(saved.id)
        useContentRendererDraft.getState().reset()
        setCollections((catalog) => [
          ...catalog,
          { ...metadata, structId: struct.id, structVersion: struct.version },
        ])
        state.message('Private collection created.')
      } catch (reason) {
        if (!ownsReply(request, epoch)) return

        setReviewRequired(
          reason instanceof ApiError &&
            reason.status === 409 &&
            reason.message === 'Struct draft changed. Review before creating.',
        )
        reportError(reason, 'Could not create collection.')
      }
    })
  }

  const disabled = state.busy || loading
  const snapshot = draft.collection?.struct ?? draft.reviewed

  return (
    <div className="collection-editor">
      <div className="page-title">
        <div>
          <h1>{t('Content')}</h1>
          <p>
            {t(
              'Create private collections from saved content models. This does not publish content or an API.',
            )}
          </p>
        </div>
      </div>
      <section className="collection-catalog">
        <label>
          {t('Choose a collection')}
          <Select
            label={t('Choose a collection')}
            value={draft.collection?.id ?? ''}
            placeholder={t('Choose a collection')}
            disabled={disabled || !collections.length}
            options={collections.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
            onValueChange={openCollection}
          />
        </label>
        <div className="collection-actions">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={newCollection}
          >
            <FilePlus2 size={16} />
            {t('New collection')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={refreshCatalog}
          >
            <RefreshCw size={16} />
            {t('Refresh')}
          </Button>
        </div>
        {loading ? (
          <p className="field-help" role="status">
            {t('Loading collections…')}
          </p>
        ) : !collections.length ? (
          <p className="field-help">{t('No collections yet')}</p>
        ) : null}
      </section>
      <section className="collection-panel">
        {draft.collection ? (
          <div className="collection-heading">
            <h2>{draft.collection.name}</h2>
            <Badge variant="outline">{t('Private collection')}</Badge>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              createCollection()
            }}
          >
            <div className="collection-heading">
              <h2>{t('New collection')}</h2>
              {draft.dirty ? (
                <Badge variant="secondary">{t('Unsaved changes')}</Badge>
              ) : null}
            </div>
            <label>
              {t('Collection name')}
              <Input
                aria-label={t('Collection name')}
                value={draft.name}
                maxLength={80}
                disabled={disabled}
                onChange={(event) => draft.editName(event.target.value)}
              />
            </label>
            <label>
              {t('Content model')}
              <Select
                label={t('Content model')}
                value={draft.modelId}
                placeholder={t('Content model')}
                disabled={disabled || !models.length}
                options={models.map((model) => ({
                  value: model.id,
                  label: model.name,
                }))}
                onValueChange={reviewModel}
              />
            </label>
            {!loading && !models.length ? (
              <p className="field-help">
                {t(
                  'Save a content model in Content models first, then refresh this catalog.',
                )}
              </p>
            ) : null}
            <p className="field-help">
              {t(
                'Review the saved model revision before creating. Later model edits do not change this collection.',
              )}
            </p>
            <div className="collection-actions">
              <Button
                type="submit"
                disabled={
                  disabled ||
                  !draft.reviewed ||
                  !draft.name.trim() ||
                  reviewRequired
                }
              >
                <Save size={16} />
                {t('Create collection')}
              </Button>
              {(reviewRequired || (!draft.reviewed && error)) &&
              draft.modelId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => reviewModel(draft.modelId)}
                >
                  {t('Review current content model')}
                </Button>
              ) : null}
            </div>
          </form>
        )}
        {snapshot ? (
          <section
            className="collection-review"
            aria-label={t('Saved content model')}
          >
            <div className="collection-heading">
              <h3>{snapshot.name}</h3>
              <Badge variant="outline">
                {t('Content model revision {version}', {
                  version: snapshot.version,
                })}
              </Badge>
              {draft.collection ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  aria-expanded={modelExpanded}
                  aria-controls={modelFieldsId}
                  onClick={() => setModelExpanded((expanded) => !expanded)}
                >
                  {t(
                    modelExpanded ? 'Hide content model' : 'View content model',
                  )}
                </Button>
              ) : null}
            </div>
            <div
              id={modelFieldsId}
              hidden={!!draft.collection && !modelExpanded}
            >
              <SavedFields fields={snapshot.fields} />
            </div>
          </section>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        ) : null}
      </section>
      {draft.collection ? (
        <ContentRendererSettings collection={draft.collection} />
      ) : null}
      {draft.collection ? (
        <ContentEntries collection={draft.collection} />
      ) : null}
    </div>
  )
}

function SavedFields({ fields }: { fields: StructField[] }) {
  const { t } = useTranslation()

  return (
    <div className="collection-fields">
      {fields.length ? (
        fields.map((field) => (
          <section className="collection-field" key={field.key}>
            <div className="collection-heading">
              <strong>{field.label}</strong>
              <Badge variant="outline">
                {t(field.required ? 'Required' : 'Optional')}
              </Badge>
            </div>
            <code>{field.key}</code>
            <SavedSchema schema={field.schema} />
          </section>
        ))
      ) : (
        <p className="field-help">{t('No fields yet')}</p>
      )}
    </div>
  )
}

function SavedSchema({ schema }: { schema: StructSchema }) {
  const { t } = useTranslation()

  return (
    <div className="collection-schema">
      <span className="field-help">
        {t(
          schema.type === 'richText' && schema.schemaVersion === 2
            ? 'Formatted rich text'
            : typeLabels[schema.type],
        )}
      </span>
      {schema.type === 'object' ? (
        <SavedFields fields={schema.fields} />
      ) : schema.type === 'array' ? (
        <div className="collection-nested">
          <span>{t('List item type')}</span>
          <SavedSchema schema={schema.items} />
        </div>
      ) : schema.type === 'select' ? (
        <ul>
          {schema.options.map((option) => (
            <li key={option.value}>
              {option.label} <code>{option.value}</code>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
