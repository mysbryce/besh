import { useEffect, useId, useRef, useState } from 'react'
import { Check, Code2, Copy, X } from 'lucide-react'
import type { HtmlField } from './content-html-fields'
import { ContentHtmlSettings } from './content-html-settings'
import { ContentHtmlReviewedSettings } from './content-html-reviewed-settings'
import { verifyCollectionRenderer } from './content-renderer-value'
import {
  canonicalHtmlRenderer,
  prepareHtmlRenderer,
  type HtmlRenderer,
  type HtmlSettings,
} from './content-html-mapping'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { api, ApiError } from '../../lib/api'
import type {
  Collection,
  CollectionRenderer,
  ContentEntry,
} from '../../types/api'
import { useStudio } from '../../stores/studio-store'
import { useTranslation } from '../../i18n'

type HtmlPreview = {
  collectionId: string
  collectionVersion: number
  structId: string
  structVersion: number
  entryId: string
  entryVersion: number
  fieldKey: string
  fieldPath?: (string | number)[]
  schemaVersion: 1 | 2
  astVersion: 1 | 2
  rendererSchemaVersion: 1
  rendererSha256: string
  rendererVersion?: number
  consumerContract: 'besh.fixed-heading-id.v1' | null
  html: string
}

type SettingsMode = 'temporary' | 'reviewed'

type SettingsSelection = {
  mode: SettingsMode
  reviewed: CollectionRenderer | null
}

function matchesPreview(
  value: unknown,
  collection: Collection,
  entry: ContentEntry,
  field: HtmlField,
  renderer: HtmlRenderer,
  rendererSha256: string,
  rendererVersion: number | undefined,
): value is HtmlPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const result = value as Record<string, unknown>
  const keys = [
    'collectionId',
    'collectionVersion',
    'structId',
    'structVersion',
    'entryId',
    'entryVersion',
    'fieldKey',
    'schemaVersion',
    'astVersion',
    'rendererSchemaVersion',
    'rendererSha256',
    'consumerContract',
    'html',
    ...(field.path.length === 1 ? [] : ['fieldPath']),
    ...(rendererVersion === undefined ? [] : ['rendererVersion']),
  ]
  if (
    Object.keys(result).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(result, key))
  )
    return false

  const pathMatches =
    field.path.length === 1
      ? !Object.hasOwn(result, 'fieldPath')
      : Array.isArray(result.fieldPath) &&
        result.fieldPath.length === field.path.length &&
        result.fieldPath.every(
          (segment, index) => segment === field.path[index],
        )

  return (
    result.collectionId === collection.id &&
    result.collectionVersion === collection.version &&
    result.structId === collection.struct.id &&
    result.structVersion === collection.struct.version &&
    result.entryId === entry.id &&
    result.entryVersion === entry.version &&
    result.fieldKey === field.key &&
    pathMatches &&
    result.schemaVersion === field.schema.schemaVersion &&
    result.astVersion === field.schema.astVersion &&
    result.rendererSchemaVersion === 1 &&
    result.rendererSha256 === rendererSha256 &&
    (rendererVersion === undefined
      ? !Object.hasOwn(result, 'rendererVersion')
      : result.rendererVersion === rendererVersion) &&
    result.consumerContract === (renderer.consumerContract ?? null) &&
    typeof result.html === 'string' &&
    new TextEncoder().encode(result.html).byteLength <= 262144
  )
}

function previewDocument(html: string) {
  // The trusted wrapper disables interaction without changing server output.
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <base target="_blank">

  <style>
    body {
      margin: 16px;
      font: 16px/1.6 system-ui, sans-serif;
      color: #17212b;
      background: #fff;
      overflow-wrap: anywhere;
    }

    h1, h2, h3, h4, h5, h6 {
      line-height: 1.25;
    }

    pre, table {
      display: block;
      max-width: 100%;
      overflow: auto;
    }

    pre {
      white-space: pre;
    }

    code {
      font-family: monospace;
    }

    th, td {
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
    }

    blockquote {
      margin-left: 0;
      padding-left: 16px;
      border-left: 3px solid #cbd5e1;
    }
  </style>
</head>
<body inert>${html}</body>
</html>`
}

export function ContentHtmlPreview({
  fields,
  collection,
  entry,
  identity,
  open,
  disabled,
  isCurrent,
  onOpen,
  onClose,
  onConflict,
}: {
  fields: HtmlField[]
  collection: Collection
  entry: ContentEntry
  identity: string
  open: boolean
  disabled: boolean
  isCurrent: () => boolean
  onOpen: () => void
  onClose: () => void
  onConflict: (message: string) => void
}) {
  const { t } = useTranslation()
  const state = useStudio()
  const reviewId = useId()
  const headingId = useId()
  const sourceId = useId()
  const firstFieldId = fields[0]?.id ?? ''
  const [fieldId, setFieldId] = useState(firstFieldId)
  const [result, setResult] = useState<HtmlPreview | null>(null)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState<'copied' | 'failed' | ''>('')
  const [settings, setSettings] = useState<HtmlSettings>({})
  const [mode, setMode] = useState<SettingsMode>('temporary')
  const [reviewed, setReviewed] = useState<CollectionRenderer | null>(null)
  const [reviewRequired, setReviewRequired] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const prepared = prepareHtmlRenderer(settings)
  const mounted = useRef(false)
  const operation = useRef(0)
  const selectedField = useRef(fieldId)
  const selection = useRef<SettingsSelection>({
    mode: 'temporary',
    reviewed: null,
  })
  const memberId = state.member?.id
  const sessionId = state.sessionId
  const token = state.token

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      operation.current += 1
    }
  }, [])

  useEffect(() => {
    operation.current += 1
    selectedField.current = firstFieldId
    selection.current = { mode: 'temporary', reviewed: null }
    setFieldId(selectedField.current)
    setResult(null)
    setError('')
    setCopyFeedback('')
    setSettings({})
    setMode('temporary')
    setReviewed(null)
    setReviewRequired(false)
    setReviewLoading(false)
  }, [identity, open, firstFieldId])

  function ownsRequest(
    request: number,
    key: string,
    expected: SettingsSelection,
  ) {
    const current = useStudio.getState()

    return (
      mounted.current &&
      operation.current === request &&
      selectedField.current === key &&
      selection.current.mode === expected.mode &&
      selection.current.reviewed === expected.reviewed &&
      current.member?.role === 'owner' &&
      current.member.id === memberId &&
      current.sessionId === sessionId &&
      current.token === token &&
      isCurrent()
    )
  }

  function chooseField(id: string) {
    if (disabled || useStudio.getState().busy || !isCurrent()) return
    if (!fields.some((field) => field.id === id)) return

    operation.current += 1
    selectedField.current = id
    setFieldId(id)
    setResult(null)
    setError('')
    setCopyFeedback('')
  }

  function chooseSettings(value: string) {
    if (disabled || !open || useStudio.getState().busy || !isCurrent()) return
    if (value !== 'temporary' && value !== 'reviewed') return
    if (value === 'reviewed' && !selection.current.reviewed) return

    operation.current += 1
    selection.current = { ...selection.current, mode: value }
    setMode(value)
    setResult(null)
    setError('')
    setCopyFeedback('')
  }

  function reviewSettings() {
    if (disabled || !open || useStudio.getState().busy || !isCurrent()) return

    const request = ++operation.current
    const key = selectedField.current
    const expected = selection.current

    setReviewLoading(true)
    setResult(null)
    setError('')
    setCopyFeedback('')

    void state.task(async () => {
      try {
        if (!ownsRequest(request, key, expected)) return

        const value = await api<unknown>(
          `/api/collections/${encodeURIComponent(collection.id)}/renderer`,
          token,
        )
        if (!ownsRequest(request, key, expected)) return

        const saved = await verifyCollectionRenderer(value, collection)
        if (!ownsRequest(request, key, expected)) return
        if (!saved) throw new Error('Could not verify HTML settings.')

        // Review owns a separate snapshot; it never adopts the settings editor's draft.
        setReviewLoading(false)
        selection.current = { mode: expected.mode, reviewed: saved }
        setReviewed(saved)
        setReviewRequired(false)
        state.message('HTML settings reviewed.')
      } catch (reason) {
        if (!ownsRequest(request, key, expected)) return

        const message =
          reason instanceof Error
            ? reason.message
            : 'Could not load HTML settings.'

        setError(message)
        state.message(message, true)
      } finally {
        if (ownsRequest(request, key, expected)) setReviewLoading(false)
      }
    })
  }

  function generatePreview() {
    if (disabled || !open || useStudio.getState().busy || !isCurrent()) return

    const field = fields.find((candidate) => candidate.id === fieldId)
    if (!field) return

    const expected = selection.current
    if (expected.mode === 'reviewed' && (!expected.reviewed || reviewRequired))
      return

    const renderer =
      expected.mode === 'reviewed'
        ? expected.reviewed?.renderer
        : prepared.renderer
    if (!renderer) return

    const rendererVersion =
      expected.mode === 'reviewed' ? expected.reviewed?.version : undefined

    const request = ++operation.current
    const key = field.id

    setResult(null)
    setError('')
    setCopyFeedback('')

    void state.task(async () => {
      try {
        if (!ownsRequest(request, key, expected)) return

        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(canonicalHtmlRenderer(renderer)),
        )
        const rendererSha256 = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('')
        if (!ownsRequest(request, key, expected)) return
        if (
          expected.mode === 'reviewed' &&
          rendererSha256 !== expected.reviewed?.rendererSha256
        )
          throw new Error('Could not verify HTML settings.')

        const value = await api<unknown>(
          `/api/collections/${encodeURIComponent(collection.id)}/entries/${encodeURIComponent(entry.id)}/render-preview`,
          token,
          'POST',
          {
            entryVersion: entry.version,
            ...(field.path.length === 1
              ? { fieldKey: field.key }
              : { fieldPath: field.path }),
            ...(rendererVersion === undefined
              ? { renderer }
              : { rendererVersion }),
          },
        )
        if (!ownsRequest(request, key, expected)) return
        if (
          !matchesPreview(
            value,
            collection,
            entry,
            field,
            renderer,
            rendererSha256,
            rendererVersion,
          )
        )
          throw new Error(
            'Could not verify this HTML preview. Generate it again.',
          )

        setResult(value)
        state.message('HTML preview generated.')
      } catch (reason) {
        if (!ownsRequest(request, key, expected)) return

        const message =
          reason instanceof Error
            ? reason.message
            : 'Could not generate HTML preview.'
        if (
          reason instanceof ApiError &&
          reason.status === 409 &&
          message === 'Content entry changed. Reload before previewing.'
        ) {
          onConflict(message)
          return
        }

        if (
          reason instanceof ApiError &&
          reason.status === 409 &&
          expected.mode === 'reviewed' &&
          message === 'Collection renderer changed. Reload before previewing.'
        ) {
          setReviewRequired(true)
          setError(
            'Saved HTML settings changed. Review collection settings again.',
          )
          state.message(
            'Saved HTML settings changed. Review collection settings again.',
            true,
          )
          return
        }

        setError(message)
        state.message(message, true)
      }
    })
  }

  function editSettings(value: HtmlSettings) {
    if (disabled || useStudio.getState().busy || !isCurrent()) return
    if (selection.current.mode !== 'temporary') return

    operation.current += 1
    setSettings(value)
    setResult(null)
    setError('')
    setCopyFeedback('')
    state.message('Private HTML preview')
  }

  function copyHtml() {
    if (disabled || !open || useStudio.getState().busy || !isCurrent()) return
    if (!result) return

    const expected = selection.current
    const field = fields.find((candidate) => candidate.id === fieldId)
    const renderer =
      expected.mode === 'reviewed'
        ? expected.reviewed?.renderer
        : prepared.renderer
    if (!field || !renderer) return
    if (expected.mode === 'reviewed' && reviewRequired) return
    if (
      !matchesPreview(
        result,
        collection,
        entry,
        field,
        renderer,
        expected.mode === 'reviewed'
          ? expected.reviewed!.rendererSha256
          : result.rendererSha256,
        expected.mode === 'reviewed' ? expected.reviewed?.version : undefined,
      )
    )
      return

    const request = ++operation.current
    const key = fieldId
    const html = result.html

    setCopyFeedback('')

    void state.task(async () => {
      if (!ownsRequest(request, key, expected)) return

      try {
        // Copy the delivered review; this does not query current server state.
        await navigator.clipboard.writeText(html)
        if (!ownsRequest(request, key, expected)) return

        setCopyFeedback('copied')
        state.message('HTML copied')
      } catch {
        if (!ownsRequest(request, key, expected)) return

        setCopyFeedback('failed')
        state.message(
          'Could not copy HTML. Select and copy the HTML source.',
          true,
        )
      }
    })
  }

  function fieldLabel(field: HtmlField) {
    return field.labels
      .map((label) =>
        typeof label === 'number' ? t('Item {index}', { index: label }) : label,
      )
      .join(' · ')
  }

  return (
    <div className="collection-review">
      <div className="collection-actions">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={reviewId}
          onClick={onOpen}
        >
          <Code2 size={16} />
          {t('Preview HTML')}
        </Button>
      </div>
      {open ? (
        <section
          id={reviewId}
          className="collection-field"
          aria-labelledby={headingId}
        >
          <div className="collection-heading">
            <h3 id={headingId}>{t('Private HTML preview')}</h3>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={onClose}
            >
              <X size={16} />
              {t('Close HTML preview')}
            </Button>
          </div>
          <div className="collection-actions">
            <Badge variant="outline">
              {t('Entry revision {version}', { version: entry.version })}
            </Badge>
          </div>
          <p className="field-help">
            {t(
              'Review the saved entry and fields. This does not save or publish content.',
            )}
          </p>
          <div>
            <p className="field-help">{t('Rich-text fields')}</p>
            <ul className="grid gap-2">
              {fields.map((field) => (
                <li key={field.id}>
                  <span>{fieldLabel(field)}</span> <code>{field.key}</code>
                </li>
              ))}
            </ul>
          </div>
          <label>
            {t('Rich-text field')}
            <Select
              label={t('Rich-text field')}
              value={fieldId}
              onValueChange={chooseField}
              options={fields.map((field) => ({
                value: field.id,
                label: fieldLabel(field),
              }))}
              disabled={disabled}
            />
          </label>
          <label>
            {t('HTML settings')}
            <Select
              label={t('HTML settings')}
              value={mode}
              onValueChange={chooseSettings}
              options={[
                { value: 'temporary', label: t('Temporary settings') },
                ...(reviewed
                  ? [
                      {
                        value: 'reviewed',
                        label: t('Reviewed collection settings'),
                      },
                    ]
                  : []),
              ]}
              disabled={disabled || state.busy}
            />
          </label>
          <p className="field-help">
            {t(
              'Review saved collection settings before using them. Reviewing does not save settings or generate HTML.',
            )}
          </p>
          <div className="collection-actions">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || state.busy}
              onClick={reviewSettings}
            >
              {t('Review collection settings')}
            </Button>
          </div>
          {reviewLoading ? (
            <p role="status">{t('Loading HTML settings…')}</p>
          ) : null}
          {reviewed ? (
            <ContentHtmlReviewedSettings
              key={reviewed.version + ':' + reviewed.rendererSha256}
              saved={reviewed}
              collection={collection}
              disabled={disabled || state.busy}
            />
          ) : null}
          {mode === 'temporary' ? (
            <ContentHtmlSettings
              settings={settings}
              disabled={disabled || state.busy}
              onChange={editSettings}
            />
          ) : null}
          {mode === 'temporary' && prepared.error ? (
            <p className="form-error" role="alert">
              {t(prepared.error)}
            </p>
          ) : null}
          <div className="collection-actions">
            <Button
              type="button"
              disabled={
                disabled ||
                state.busy ||
                (mode === 'temporary'
                  ? !!prepared.error
                  : !reviewed || reviewRequired)
              }
              onClick={generatePreview}
            >
              <Code2 size={16} />
              {t('Generate HTML preview')}
            </Button>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          ) : null}
          {result ? (
            <div className="grid gap-3">
              <p className="field-help">
                {t(
                  'Visual preview only. Links are inactive. HTML source is available below.',
                )}
              </p>
              <iframe
                title={t('Rendered HTML preview')}
                sandbox=""
                tabIndex={-1}
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="min-h-60 w-full rounded-md border border-input bg-white"
                srcDoc={previewDocument(result.html)}
              />
              <label htmlFor={sourceId}>
                {t('HTML source')}
                <Textarea
                  id={sourceId}
                  readOnly
                  value={result.html}
                  className="content-html-source max-h-80 min-h-32 resize-y font-mono"
                  spellCheck={false}
                />
              </label>
              <div className="collection-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={copyHtml}
                >
                  {copyFeedback === 'copied' ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {t(copyFeedback === 'copied' ? 'HTML copied' : 'Copy HTML')}
                </Button>
              </div>
              {copyFeedback === 'failed' ? (
                <p className="form-error" role="alert">
                  {t('Could not copy HTML. Select and copy the HTML source.')}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
