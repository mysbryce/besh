import { useEffect, useRef, useState } from 'react'
import { FilePlus2, Pencil, RefreshCw, Save, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import {
  api,
  type Collection,
  type ContentEntry,
  type ContentEntryPage,
} from './lib/api'
import { useStudio } from './store'
import { useCollectionDraft } from './collection-store'
import { useDateTime, useTranslation } from './i18n'
import { ContentFields } from './content-fields'
import { ContentHtmlPreview } from './content-html-preview'
import { savedHtmlFields } from './content-html-fields'
import { prepareEntry, useContentEntryDraft } from './content-entry-store'

type EntryError = {
  message: string
  origin: 'catalog' | 'detail' | 'write'
}

export function ContentEntries({ collection }: { collection: Collection }) {
  const state = useStudio()
  const draft = useContentEntryDraft()
  const { t } = useTranslation()
  const dateTime = useDateTime()
  const [catalog, setCatalog] = useState<ContentEntryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<EntryError | null>(null)
  const [reviewRequired, setReviewRequired] = useState(false)
  const [htmlReviewIdentity, setHtmlReviewIdentity] = useState<string | null>(
    null,
  )
  const currentError = useRef<EntryError | null>(null)
  const mounted = useRef(false)
  const operation = useRef(0)
  const memberId = state.member?.id
  const role = state.member?.role
  const sessionId = state.sessionId
  const token = state.token
  const collectionId = collection.id
  const htmlIdentity = JSON.stringify([
    collectionId,
    memberId,
    role,
    sessionId,
    token,
    collection.version,
    collection.struct.id,
    collection.struct.version,
    draft.entry?.id,
    draft.entry?.version,
    draft.epoch,
  ])

  useEffect(() => {
    setHtmlReviewIdentity(null)
  }, [htmlIdentity, reviewRequired])

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

    if (useContentEntryDraft.getState().collectionId !== collectionId)
      draft.reset(collectionId)

    setLoading(true)
    setCatalog(null)
    clearError()
    setReviewRequired(false)

    void api<ContentEntryPage>(entryPath() + '?offset=0&limit=20', token)
      .then((value) => {
        if (active && ownsReply(request)) setCatalog(value)
      })
      .catch((reason: unknown) => {
        if (active && ownsReply(request))
          reportError(reason, 'Could not load entries.', 'catalog')
      })
      .finally(() => {
        if (active && ownsReply(request)) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [collectionId, memberId, role, sessionId, token])

  function entryPath() {
    return `/api/collections/${encodeURIComponent(collectionId)}/entries`
  }

  function ownsReply(request?: number, epoch?: number) {
    const current = useStudio.getState()

    return (
      mounted.current &&
      current.member?.role === 'owner' &&
      current.member.id === memberId &&
      current.sessionId === sessionId &&
      current.token === token &&
      useCollectionDraft.getState().collection?.id === collectionId &&
      useContentEntryDraft.getState().collectionId === collectionId &&
      (request === undefined || operation.current === request) &&
      (epoch === undefined || useContentEntryDraft.getState().epoch === epoch)
    )
  }

  function reportError(
    reason: unknown,
    fallback: string,
    origin: EntryError['origin'],
  ) {
    if (origin === 'catalog' && currentError.current?.origin !== 'catalog') {
      const unresolved = currentError.current

      if (unresolved) {
        state.message(unresolved.message, true)
        return
      }
    }

    const message = reason instanceof Error ? reason.message : fallback
    const next = { message, origin }

    currentError.current = next
    setError(next)
    state.message(message, true)
  }

  function clearError() {
    currentError.current = null
    setError(null)
  }

  function discard() {
    return (
      !useContentEntryDraft.getState().dirty ||
      window.confirm(t('Discard unsaved entry changes?'))
    )
  }

  function newEntry() {
    if (!ownsReply() || useStudio.getState().busy || loading || !discard())
      return

    operation.current += 1
    draft.begin(collection)
    clearError()
    setReviewRequired(false)
    state.message('New entry')
  }

  function editEntry() {
    const current = useContentEntryDraft.getState()

    if (
      !ownsReply() ||
      useStudio.getState().busy ||
      loading ||
      !current.entry ||
      current.editing ||
      reviewRequired
    )
      return

    operation.current += 1
    draft.startEditing()
    clearError()
    setReviewRequired(false)
    state.message('Edit entry')
  }

  function loadPage(offset: number) {
    if (!ownsReply() || useStudio.getState().busy || loading) return

    const epoch = useContentEntryDraft.getState().epoch
    const request = ++operation.current

    void state.task(async () => {
      try {
        const page = await api<ContentEntryPage>(
          entryPath() + `?offset=${offset}&limit=20`,
          token,
        )
        if (!ownsReply(request, epoch)) return

        setCatalog(page)

        if (currentError.current?.origin === 'catalog') clearError()

        const remaining = currentError.current

        state.message(remaining?.message ?? 'Workspace ready.', !!remaining)
      } catch (reason) {
        if (ownsReply(request, epoch))
          reportError(reason, 'Could not load entries.', 'catalog')
      }
    })
  }

  function openEntry(id: string) {
    if (!ownsReply() || useStudio.getState().busy || loading || !discard())
      return

    const epoch = useContentEntryDraft.getState().epoch
    const request = ++operation.current

    void state.task(async () => {
      try {
        const entry = await api<ContentEntry>(
          entryPath() + `/${encodeURIComponent(id)}`,
          token,
        )
        if (!ownsReply(request, epoch)) return

        draft.show(collection, entry)
        clearError()
        setReviewRequired(false)
        state.message('Entry loaded.')
      } catch (reason) {
        if (ownsReply(request, epoch))
          reportError(reason, 'Could not load entry.', 'detail')
      }
    })
  }

  function saveEntry() {
    const current = useContentEntryDraft.getState()

    if (
      !ownsReply() ||
      useStudio.getState().busy ||
      loading ||
      !current.active ||
      (current.entry && !current.editing) ||
      (current.entry && !current.dirty) ||
      reviewRequired
    )
      return

    const prepared = prepareEntry(collection.struct.fields, current.fields)
    if (prepared.error) return

    const epoch = current.epoch
    const request = ++operation.current
    const original = current.entry

    function ownsSaveReply() {
      const selected = useContentEntryDraft.getState().entry

      return (
        ownsReply(request, epoch) &&
        selected?.id === original?.id &&
        selected?.version === original?.version
      )
    }

    void state.task(async () => {
      try {
        const entry = await api<ContentEntry>(
          original
            ? entryPath() + `/${encodeURIComponent(original.id)}`
            : entryPath(),
          token,
          original ? 'PUT' : 'POST',
          original
            ? { version: original.version, data: prepared.data }
            : { data: prepared.data },
        )
        if (!ownsSaveReply()) return

        draft.show(collection, entry)
        clearError()
        setReviewRequired(false)
        state.message(original ? 'Entry saved.' : 'Private entry created.')
      } catch (reason) {
        if (ownsSaveReply()) {
          if (
            original &&
            reason instanceof Error &&
            reason.message === 'Content entry changed. Reload before saving.'
          )
            setReviewRequired(true)

          reportError(
            reason,
            original ? 'Could not save entry.' : 'Could not create entry.',
            'write',
          )
        }

        return
      }

      const savedEpoch = useContentEntryDraft.getState().epoch

      try {
        const page = await api<ContentEntryPage>(
          entryPath() + '?offset=0&limit=20',
          token,
        )
        if (ownsReply(request, savedEpoch)) setCatalog(page)
      } catch (reason) {
        if (ownsReply(request, savedEpoch))
          reportError(reason, 'Could not load entries.', 'catalog')
      }
    })
  }

  function deleteEntry() {
    const current = useContentEntryDraft.getState()
    const entry = current.entry

    if (
      !ownsReply() ||
      useStudio.getState().busy ||
      loading ||
      !entry ||
      reviewRequired
    )
      return

    const original = entry

    if (
      !window.confirm(
        t(
          'Delete this saved entry? This permanently removes its saved content and discards any unsaved entry changes.',
        ),
      )
    )
      return

    const epoch = current.epoch
    const request = ++operation.current

    function ownsDeleteReply() {
      const selected = useContentEntryDraft.getState().entry

      return (
        ownsReply(request, epoch) &&
        selected?.id === original.id &&
        selected.version === original.version
      )
    }

    if (!ownsDeleteReply() || useStudio.getState().busy) return

    void state.task(async () => {
      try {
        await api<{ ok: true }>(
          entryPath() + `/${encodeURIComponent(original.id)}`,
          token,
          'DELETE',
          { version: original.version },
        )
        if (!ownsDeleteReply()) return

        draft.reset(collectionId)
        clearError()
        setReviewRequired(false)
        state.message('Entry deleted.')
      } catch (reason) {
        if (ownsDeleteReply()) {
          if (
            reason instanceof Error &&
            reason.message === 'Content entry changed. Reload before deleting.'
          )
            setReviewRequired(true)

          reportError(reason, 'Could not delete entry.', 'write')
        }

        return
      }

      const savedEpoch = useContentEntryDraft.getState().epoch

      try {
        const page = await api<ContentEntryPage>(
          entryPath() + '?offset=0&limit=20',
          token,
        )
        if (ownsReply(request, savedEpoch)) setCatalog(page)
      } catch (reason) {
        if (ownsReply(request, savedEpoch))
          reportError(reason, 'Could not load entries.', 'catalog')
      }
    })
  }

  const active = draft.collectionId === collectionId && draft.active
  const disabled = loading || state.busy
  const editable = !draft.entry || draft.editing
  const htmlFields = draft.entry
    ? savedHtmlFields(collection.struct.fields, draft.entry.data)
    : []
  const canReviewHtml =
    role === 'owner' &&
    active &&
    !!draft.entry &&
    !draft.editing &&
    !draft.dirty &&
    htmlFields.length > 0

  function openHtmlReview() {
    const current = useContentEntryDraft.getState()

    if (
      !ownsReply(undefined, draft.epoch) ||
      useStudio.getState().busy ||
      loading ||
      reviewRequired ||
      !canReviewHtml ||
      current.editing ||
      current.dirty ||
      current.entry?.id !== draft.entry?.id ||
      current.entry?.version !== draft.entry?.version
    )
      return

    setHtmlReviewIdentity(htmlIdentity)
  }

  function ownsHtmlReview() {
    const current = useContentEntryDraft.getState()

    return (
      ownsReply(undefined, draft.epoch) &&
      htmlReviewIdentity === htmlIdentity &&
      !reviewRequired &&
      !current.editing &&
      !current.dirty &&
      current.entry?.id === draft.entry?.id &&
      current.entry?.version === draft.entry?.version
    )
  }

  const validation =
    active && editable
      ? prepareEntry(collection.struct.fields, draft.fields).error
      : null

  return (
    <section className="collection-panel content-entries">
      <div className="collection-heading">
        <h3>{t('Entries')}</h3>
        <div className="collection-actions">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={newEntry}
          >
            <FilePlus2 size={16} />
            {t('New entry')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => loadPage(catalog?.offset ?? 0)}
          >
            <RefreshCw size={16} />
            {t('Refresh entries')}
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="field-help" role="status">
          {t('Loading entries…')}
        </p>
      ) : catalog?.entries.length ? (
        <div className="content-entry-list">
          {catalog.entries.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              variant="outline"
              className="content-entry-row"
              disabled={disabled}
              onClick={() => openEntry(entry.id)}
            >
              <code>{entry.id}</code>
              <span>{t('Revision {version}', { version: entry.version })}</span>
              <time dateTime={entry.updatedAt}>
                {dateTime(entry.updatedAt)}
              </time>
            </Button>
          ))}
        </div>
      ) : (
        <p className="field-help">{t('No entries yet')}</p>
      )}
      {catalog ? (
        <div className="collection-actions">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || catalog.offset === 0}
            onClick={() => loadPage(Math.max(0, catalog.offset - 20))}
          >
            {t('Previous entries')}
          </Button>
          <span className="field-help">
            {t('{total} saved entries', { total: catalog.total })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={
              disabled ||
              catalog.offset + catalog.entries.length >= catalog.total
            }
            onClick={() => loadPage(catalog.offset + 20)}
          >
            {t('Next entries')}
          </Button>
        </div>
      ) : null}
      {active ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            saveEntry()
          }}
        >
          <div className="collection-heading">
            <h3>
              {t(
                draft.editing
                  ? 'Edit entry'
                  : draft.entry
                    ? 'Saved entry'
                    : 'New entry',
              )}
            </h3>
            {draft.entry ? (
              <Badge variant="outline">
                {t('Entry revision {version}', {
                  version: draft.entry.version,
                })}
              </Badge>
            ) : (
              <Badge variant="secondary">{t('Unsaved changes')}</Badge>
            )}
          </div>
          {draft.entry ? (
            <div className="collection-actions">
              {!draft.editing ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled || reviewRequired}
                  onClick={editEntry}
                >
                  <Pencil size={16} />
                  {t('Edit entry')}
                </Button>
              ) : draft.dirty ? (
                <Badge variant="secondary">{t('Unsaved changes')}</Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  if (draft.entry) openEntry(draft.entry.id)
                }}
              >
                <RefreshCw size={16} />
                {t('Reload entry')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || reviewRequired}
                onClick={deleteEntry}
              >
                <Trash2 size={16} />
                {t('Delete entry')}
              </Button>
            </div>
          ) : null}
          {canReviewHtml && draft.entry ? (
            <ContentHtmlPreview
              fields={htmlFields}
              collection={collection}
              entry={draft.entry}
              identity={htmlIdentity}
              open={htmlReviewIdentity === htmlIdentity && !reviewRequired}
              disabled={disabled || reviewRequired}
              isCurrent={ownsHtmlReview}
              onOpen={openHtmlReview}
              onClose={() => setHtmlReviewIdentity(null)}
              onConflict={(message) => {
                setReviewRequired(true)
                reportError(new Error(message), message, 'detail')
              }}
            />
          ) : null}
          {draft.entry ? <code>{draft.entry.id}</code> : null}
          <p className="field-help">
            {t(
              'Optional fields are omitted unless included. Empty text, zero, false, empty groups and empty lists are allowed when they match this model.',
            )}
          </p>
          <ContentFields
            fields={collection.struct.fields}
            values={draft.fields}
            disabled={disabled || !editable}
            onChange={draft.edit}
          />
          {editable ? (
            <>
              {validation ? (
                <p className="field-help">
                  {t(validation.key, validation.values)}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={
                  disabled ||
                  !!validation ||
                  reviewRequired ||
                  (!!draft.entry && !draft.dirty)
                }
              >
                <Save size={16} />
                {t(draft.entry ? 'Save entry' : 'Create entry')}
              </Button>
            </>
          ) : null}
        </form>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {t(error.message)}
        </p>
      ) : null}
    </section>
  )
}
