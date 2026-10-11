import { useEffect, useId, useRef, useState } from 'react'
import { Code2, RefreshCw, Save, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { api, ApiError } from '../../lib/api'
import type { Collection } from '../../types/api'
import { useStudio } from '../../stores/studio-store'
import { useCollectionDraft } from '../../stores/collection-store'
import { useContentRendererDraft } from '../../stores/content-renderer-store'
import { useTranslation } from '../../i18n'
import {
  canonicalHtmlRenderer,
  htmlElements,
  type HtmlRenderer,
  type HtmlSettings,
} from './content-html-mapping'
import { ContentHtmlSettings } from './content-html-settings'
import {
  patchRendererSettings,
  rendererSettings,
  rendererWire,
  sameRendererSettings,
  verifyCollectionRenderer,
} from './content-renderer-value'

const unconfirmedSave =
  'Save could not be confirmed. Reload HTML settings before trying again.'

function hasDefaultSettings(
  renderer: HtmlRenderer | null,
  settings: HtmlSettings,
  error: string,
) {
  return (
    !!renderer &&
    Object.keys(renderer.elements).length === 0 &&
    !Object.hasOwn(renderer, 'consumerContract') &&
    sameRendererSettings(settings, {}) &&
    !error
  )
}

export function ContentRendererSettings({
  collection,
}: {
  collection: Collection
}) {
  const state = useStudio()
  const draft = useContentRendererDraft()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const reviewId = useId()
  const headingId = useId()
  const mounted = useRef(false)
  const operation = useRef(0)
  const openedIdentity = useRef('')
  const reviewedIdentity = useRef('')
  const memberId = state.member?.id
  const role = state.member?.role
  const sessionId = state.sessionId
  const token = state.token
  const identity = JSON.stringify([
    collection.id,
    collection.version,
    collection.struct.id,
    collection.struct.version,
    memberId,
    role,
    sessionId,
    token,
  ])

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      operation.current += 1
    }
  }, [])

  useEffect(() => {
    operation.current += 1
    openedIdentity.current = ''
    reviewedIdentity.current = ''
    useContentRendererDraft.getState().reset()
    setOpen(false)
    setLoading(false)
    setError('')
  }, [
    collection.id,
    collection.version,
    collection.struct.id,
    collection.struct.version,
    memberId,
    role,
    sessionId,
    token,
  ])

  function ownsReview(
    request?: number,
    epoch?: number,
    collectionEpoch?: number,
  ) {
    const current = useStudio.getState()
    const selected = useCollectionDraft.getState()

    return (
      mounted.current &&
      current.member?.role === 'owner' &&
      current.member.id === memberId &&
      current.sessionId === sessionId &&
      current.token === token &&
      selected.collection?.id === collection.id &&
      selected.collection.version === collection.version &&
      selected.collection.struct.id === collection.struct.id &&
      selected.collection.struct.version === collection.struct.version &&
      (request === undefined || operation.current === request) &&
      (epoch === undefined ||
        useContentRendererDraft.getState().epoch === epoch) &&
      (collectionEpoch === undefined || selected.epoch === collectionEpoch)
    )
  }

  function review() {
    if (useContentRendererDraft.getState().dirty) return

    loadReview()
  }

  function reload() {
    if (!ownsReview() || useStudio.getState().busy) return

    if (
      useContentRendererDraft.getState().dirty &&
      !window.confirm(t('Discard unsaved HTML settings?'))
    )
      return

    loadReview()
  }

  function loadReview() {
    if (!ownsReview() || useStudio.getState().busy) return

    const request = ++operation.current
    const epoch = useContentRendererDraft.getState().epoch
    const collectionEpoch = useCollectionDraft.getState().epoch

    openedIdentity.current = identity
    setOpen(true)
    setLoading(true)
    setError('')

    void state.task(async () => {
      try {
        const value = await api<unknown>(
          `/api/collections/${encodeURIComponent(collection.id)}/renderer`,
          token,
        )
        if (!ownsReview(request, epoch, collectionEpoch)) return

        const saved = await verifyCollectionRenderer(value, collection)
        if (!ownsReview(request, epoch, collectionEpoch)) return
        if (!saved) throw new Error('Could not verify HTML settings.')

        reviewedIdentity.current = identity
        useContentRendererDraft
          .getState()
          .review(saved, rendererSettings(saved.renderer), epoch)
        state.message('HTML settings reviewed.')
      } catch (reason) {
        if (!ownsReview(request, epoch, collectionEpoch)) return

        const message =
          reason instanceof Error
            ? reason.message
            : 'Could not load HTML settings.'

        setError(message)
        state.message(message, true)
      } finally {
        if (ownsReview(request, epoch, collectionEpoch)) setLoading(false)
      }
    })
  }

  function close() {
    if (!ownsReview() || useStudio.getState().busy || draft.dirty) return

    operation.current += 1
    openedIdentity.current = ''
    setOpen(false)
    setError('')
  }

  function edit(settings: HtmlSettings) {
    const current = useContentRendererDraft.getState()
    if (
      !ownsReview() ||
      useStudio.getState().busy ||
      !open ||
      reviewedIdentity.current !== identity ||
      !current.saved ||
      !current.renderer
    )
      return

    const patched = patchRendererSettings(
      current.renderer,
      current.settings,
      settings,
    )
    const dirty =
      !sameRendererSettings(
        settings,
        rendererSettings(current.saved.renderer),
      ) ||
      canonicalHtmlRenderer(patched.renderer) !==
        canonicalHtmlRenderer(current.saved.renderer)

    operation.current += 1
    current.edit({ ...patched, settings, dirty }, current.epoch)

    const updated = useContentRendererDraft.getState()
    if (!updated.conflict && !updated.unconfirmed) setError('')
  }

  function save() {
    const current = useContentRendererDraft.getState()
    if (
      !ownsReview() ||
      useStudio.getState().busy ||
      !open ||
      reviewedIdentity.current !== identity ||
      !current.saved ||
      !current.dirty ||
      current.conflict ||
      current.unconfirmed ||
      current.error ||
      !current.renderer ||
      !rendererWire(current.renderer) ||
      current.saved.version === Number.MAX_SAFE_INTEGER
    )
      return

    const submitted = structuredClone(current.renderer)
    const version = current.saved.version
    const request = ++operation.current
    const epoch = current.epoch
    const collectionEpoch = useCollectionDraft.getState().epoch

    setError('')

    void state.task(async () => {
      try {
        const value = await api<unknown>(
          `/api/collections/${encodeURIComponent(collection.id)}/renderer`,
          token,
          'PUT',
          { version, renderer: submitted },
        )
        if (!ownsReview(request, epoch, collectionEpoch)) return

        const saved = await verifyCollectionRenderer(value, collection)
        if (!ownsReview(request, epoch, collectionEpoch)) return
        if (
          !saved ||
          saved.version !== version + 1 ||
          canonicalHtmlRenderer(saved.renderer) !==
            canonicalHtmlRenderer(submitted)
        )
          throw new Error('Could not verify HTML settings.')

        useContentRendererDraft
          .getState()
          .review(saved, rendererSettings(saved.renderer), epoch)
        state.message('HTML settings saved.')
      } catch (reason) {
        if (!ownsReview(request, epoch, collectionEpoch)) return

        if (reason instanceof ApiError && reason.status === 409)
          useContentRendererDraft.getState().markConflict(epoch)

        const unconfirmed =
          !(reason instanceof ApiError) || reason.status >= 500
        if (unconfirmed)
          useContentRendererDraft.getState().markUnconfirmed(epoch)

        const message = unconfirmed
          ? unconfirmedSave
          : reason instanceof Error
            ? reason.message
            : 'Could not save HTML settings.'

        setError(message)
        state.message(message, true)
      }
    })
  }

  function useDefaults() {
    const current = useContentRendererDraft.getState()
    if (
      !ownsReview() ||
      useStudio.getState().busy ||
      !open ||
      reviewedIdentity.current !== identity ||
      !current.saved ||
      hasDefaultSettings(current.renderer, current.settings, current.error)
    )
      return

    if (current.dirty && !window.confirm(t('Discard unsaved HTML settings?')))
      return
    if (!ownsReview() || useStudio.getState().busy) return

    const renderer: HtmlRenderer = { schemaVersion: 1, elements: {} }
    const dirty =
      canonicalHtmlRenderer(renderer) !==
      canonicalHtmlRenderer(current.saved.renderer)

    operation.current += 1
    current.edit({ renderer, settings: {}, error: '', dirty }, current.epoch)

    const updated = useContentRendererDraft.getState()
    if (!updated.conflict && !updated.unconfirmed) setError('')
  }

  const saved = draft.saved
  const currentSaved =
    reviewedIdentity.current === identity &&
    saved?.collectionId === collection.id &&
    saved.collectionVersion === collection.version &&
    saved.structId === collection.struct.id &&
    saved.structVersion === collection.struct.version
      ? saved
      : null
  const disabled = state.busy || role !== 'owner'
  const expanded = open && openedIdentity.current === identity
  const reviewError = draft.unconfirmed ? unconfirmedSave : error || draft.error

  if (role !== 'owner') return null

  return (
    <div className="collection-review">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 whitespace-normal"
        disabled={disabled || draft.dirty}
        aria-expanded={expanded}
        aria-controls={reviewId}
        onClick={review}
      >
        <Code2 size={16} />
        {t('Review HTML settings')}
      </Button>
      {expanded ? (
        <section
          id={reviewId}
          className="collection-field"
          aria-labelledby={headingId}
          aria-busy={loading}
        >
          <div className="collection-heading">
            <h3 id={headingId}>{t('Collection HTML settings')}</h3>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 whitespace-normal"
              disabled={disabled || draft.dirty}
              onClick={close}
            >
              <X size={16} />
              {t('Close HTML settings')}
            </Button>
          </div>
          <p className="field-help">
            {t(
              'These settings apply to rich-text fields in this collection. Reviewing them does not save or publish content.',
            )}
          </p>
          {!loading && reviewError ? (
            <p className="form-error" role="alert">
              {t(reviewError)}
            </p>
          ) : null}
          {loading ? <p role="status">{t('Loading HTML settings…')}</p> : null}
          {currentSaved ? (
            <div className="grid min-w-0 gap-3">
              <Badge variant="outline" className="whitespace-normal">
                {currentSaved.version === 0
                  ? t('Default HTML settings · not saved')
                  : t('Renderer revision {version}', {
                      version: currentSaved.version,
                    })}
              </Badge>
              <p className="field-help">
                {t(
                  'Summary of the last reviewed settings. Unsaved edits are shown below.',
                )}
              </p>
              <p>{t('Configured elements')}</p>
              {Object.keys(currentSaved.renderer.elements).length === 0 ? (
                <p className="field-help">{t('No custom element settings')}</p>
              ) : (
                <ul className="grid min-w-0 gap-3">
                  {htmlElements.map(({ tag, label }) => {
                    const element = currentSaved.renderer.elements[tag]
                    if (!element) return null

                    return (
                      <li key={tag} className="min-w-0 break-words">
                        <p>
                          {t(label)} <code>{tag}</code>
                        </p>
                        {element.classes !== undefined ? (
                          <p>
                            {t('CSS classes')}:{' '}
                            <code>{JSON.stringify(element.classes)}</code>
                          </p>
                        ) : null}
                        {element.attributes !== undefined ? (
                          <dl>
                            {Object.entries(element.attributes).map(
                              ([name, value]) => (
                                <div key={name}>
                                  <dt>
                                    {name === 'title'
                                      ? t('Title attribute')
                                      : name === 'aria-label'
                                        ? t('Accessibility label')
                                        : 'x-data'}
                                  </dt>
                                  <dd className="whitespace-pre-wrap break-words">
                                    {JSON.stringify(value)}
                                  </dd>
                                </div>
                              ),
                            )}
                          </dl>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
              {currentSaved.consumerContract ? (
                <p className="field-help break-words">
                  {t('Consumer contract')}:{' '}
                  <code>{currentSaved.consumerContract}</code>
                </p>
              ) : null}
              <ContentHtmlSettings
                settings={draft.settings}
                disabled={disabled}
                onChange={edit}
              />
              <div className="collection-actions">
                <Button
                  type="button"
                  className="min-h-11 whitespace-normal"
                  disabled={
                    disabled ||
                    !draft.dirty ||
                    draft.conflict ||
                    draft.unconfirmed ||
                    !!draft.error ||
                    currentSaved.version === Number.MAX_SAFE_INTEGER
                  }
                  onClick={save}
                >
                  <Save size={16} />
                  {t('Save HTML settings')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 whitespace-normal"
                  disabled={disabled}
                  onClick={reload}
                >
                  <RefreshCw size={16} />
                  {t('Reload HTML settings')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 whitespace-normal"
                  disabled={
                    disabled ||
                    hasDefaultSettings(
                      draft.renderer,
                      draft.settings,
                      draft.error,
                    )
                  }
                  onClick={useDefaults}
                >
                  {t('Use default settings')}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
