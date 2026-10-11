import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { api, ApiError } from '../../lib/api'
import { useStudio } from '../../stores/studio-store'
import { useStructDraft } from '../../stores/struct-store'
import { useCollectionDraft } from '../../stores/collection-store'
import { useContentEntryDraft } from '../../stores/content-entry-store'
import { useContentRendererDraft } from '../../stores/content-renderer-store'
import { useContentSnapshot } from '../../stores/content-snapshot-store'
import type {
  Collection,
  CollectionRenderer,
  ContentEntry,
  SavedFlow,
} from '../../types/api'
import { useTranslation } from '../../i18n'
import type { HtmlField } from './content-html-fields'
import type { HtmlPreview } from './content-html-preview'
import { verifyContentSnapshotFlow } from './content-snapshot-value'

const dirtyMessage =
  'Save or discard unsaved changes before creating a Content API.'
const staleMessage =
  'The reviewed content changed. Review it again before creating a Content API.'
const uncertainMessage =
  'Creation could not be confirmed. Review the API list before creating again.'

function cleanDrafts() {
  return (
    !useStudio.getState().dirty &&
    !useStructDraft.getState().dirty &&
    !useCollectionDraft.getState().dirty &&
    !useContentEntryDraft.getState().dirty &&
    !useContentEntryDraft.getState().editing &&
    !useContentRendererDraft.getState().dirty
  )
}

export function ContentSnapshotCreate({
  collection,
  entry,
  field,
  preview,
  reviewed,
  disabled,
  isCurrent,
  onCreated,
  onOpen,
}: {
  collection: Collection
  entry: ContentEntry
  field: HtmlField
  preview: HtmlPreview
  reviewed: CollectionRenderer
  disabled: boolean
  isCurrent: () => boolean
  onCreated?: (flow: SavedFlow) => void
  onOpen?: (flow: SavedFlow) => void
}) {
  const { t } = useTranslation()
  const state = useStudio()
  const structDirty = useStructDraft((draft) => draft.dirty)
  const collectionDirty = useCollectionDraft((draft) => draft.dirty)
  const entryDirty = useContentEntryDraft(
    (draft) => draft.dirty || draft.editing,
  )
  const rendererDirty = useContentRendererDraft((draft) => draft.dirty)
  const [name, setName] = useState('')
  const [path, setPath] = useState('/article-snapshot')
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [created, setCreated] = useState<SavedFlow | null>(null)
  const mounted = useRef(false)
  const operation = useRef(0)
  const scope = JSON.stringify([state.member?.id, state.sessionId, state.token])
  const unconfirmed = useContentSnapshot(
    (snapshot) => !!snapshot.unconfirmed[scope],
  )
  const dirty =
    state.dirty || structDirty || collectionDirty || entryDirty || rendererDirty
  const validName = name.trim().length >= 1 && name.trim().length <= 80
  const validPath =
    path.length <= 160 && /^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path)
  const blocked =
    disabled ||
    state.busy ||
    dirty ||
    stale ||
    unconfirmed ||
    !!created ||
    !validName ||
    !validPath

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      operation.current += 1
    }
  }, [])

  function create() {
    const current = useStudio.getState()
    const selected = useContentEntryDraft.getState()

    if (
      disabled ||
      current.busy ||
      stale ||
      unconfirmed ||
      created ||
      !isCurrent()
    )
      return

    if (!cleanDrafts()) {
      setError(dirtyMessage)
      return
    }
    if (
      current.member?.role !== 'owner' ||
      preview.rendererVersion !== reviewed.version
    )
      return

    const literalName = name.trim()
    if (
      !literalName ||
      literalName.length > 80 ||
      path.length > 160 ||
      !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path)
    )
      return

    const request = ++operation.current
    const proof = {
      memberId: current.member.id,
      sessionId: current.sessionId,
      token: current.token,
      editorSession: current.editorSession,
      entryEpoch: selected.epoch,
      collectionEpoch: useCollectionDraft.getState().epoch,
      structEpoch: useStructDraft.getState().epoch,
      rendererEpoch: useContentRendererDraft.getState().epoch,
    }
    const body = {
      name: literalName,
      path,
      collectionVersion: preview.collectionVersion,
      entryVersion: preview.entryVersion,
      rendererVersion: preview.rendererVersion,
      fieldPath: [...field.path],
    }

    function ownsRequest() {
      const owner = useStudio.getState()
      const content = useContentEntryDraft.getState()
      const selectedCollection = useCollectionDraft.getState()

      return (
        mounted.current &&
        operation.current === request &&
        isCurrent() &&
        owner.member?.role === 'owner' &&
        owner.member.id === proof.memberId &&
        owner.sessionId === proof.sessionId &&
        owner.token === proof.token &&
        owner.editorSession === proof.editorSession &&
        cleanDrafts() &&
        content.epoch === proof.entryEpoch &&
        !content.editing &&
        content.collectionId === collection.id &&
        content.entry?.id === entry.id &&
        content.entry.version === entry.version &&
        selectedCollection.epoch === proof.collectionEpoch &&
        selectedCollection.collection?.id === collection.id &&
        selectedCollection.collection.version === collection.version &&
        useStructDraft.getState().epoch === proof.structEpoch &&
        useContentRendererDraft.getState().epoch === proof.rendererEpoch
      )
    }

    setError('')

    void current.task(async () => {
      if (!ownsRequest()) return

      try {
        const value = await api<unknown>(
          `/api/collections/${encodeURIComponent(collection.id)}/entries/${encodeURIComponent(entry.id)}/snapshot-flow`,
          proof.token,
          'POST',
          body,
        )
        if (!ownsRequest()) {
          useContentSnapshot.getState().markUnconfirmed(scope)
          return
        }

        const flow = verifyContentSnapshotFlow(value, body.name, body.path)
        if (!flow) throw new Error(uncertainMessage)

        setCreated(flow)
        onCreated?.(flow)
        current.message('Content API draft created.')
      } catch (reason) {
        const uncertain = !(reason instanceof ApiError) || reason.status >= 500
        if (uncertain) useContentSnapshot.getState().markUnconfirmed(scope)
        if (!ownsRequest()) return

        const conflict = reason instanceof ApiError && reason.status === 409
        const message = uncertain
          ? uncertainMessage
          : conflict
            ? staleMessage
            : reason instanceof Error
              ? reason.message
              : uncertainMessage

        setStale(conflict)
        setError(message)
        current.message(message, true)
      }
    })
  }

  return (
    <div
      className="form-stack"
      role="group"
      aria-label={t('Create Content API')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault()
          create()
        }
      }}
    >
      <p className="field-help">
        {t('Creates a sealed draft. This does not publish an API.')}
      </p>
      <div className="collection-actions">
        <span>
          {t('Entry revision {version}', { version: preview.entryVersion })}
        </span>
        <span>
          {t('Renderer revision {version}', { version: reviewed.version })}
        </span>
        <span>
          {t('Rich-text field')}:{' '}
          {field.labels
            .map((label) =>
              typeof label === 'number'
                ? t('Item {index}', { index: label })
                : label,
            )
            .join(' · ')}
        </span>
      </div>
      <label>
        {t('API name')}
        <Input
          maxLength={80}
          value={name}
          aria-invalid={name.length > 0 && !validName}
          disabled={disabled || state.busy}
          onChange={(event) => {
            setName(event.target.value)
            if (!stale) setError('')
          }}
        />
      </label>
      <label>
        {t('Endpoint path')}
        <Input
          maxLength={160}
          placeholder="/article-snapshot"
          value={path}
          aria-invalid={!validPath}
          disabled={disabled || state.busy}
          onChange={(event) => {
            setPath(event.target.value)
            if (!stale) setError('')
          }}
        />
      </label>
      {dirty || unconfirmed || error ? (
        <p className="form-error" role="alert">
          {t(unconfirmed ? uncertainMessage : dirty ? dirtyMessage : error)}
        </p>
      ) : null}
      {created ? <p role="status">{t('Content API draft created.')}</p> : null}
      <div className="collection-actions">
        <Button type="button" disabled={blocked} onClick={create}>
          {t('Create Content API')}
        </Button>
        {created && onOpen ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || state.busy}
            onClick={() => {
              if (!useStudio.getState().busy && isCurrent()) onOpen(created)
            }}
          >
            {t('Open API Studio')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
