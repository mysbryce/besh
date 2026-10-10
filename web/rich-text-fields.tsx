import { useLayoutEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Textarea } from './components/ui/textarea'
import { useTranslation } from './i18n'
import type { ContentValue } from './content-entry-store'

type RichTextValue = Extract<ContentValue, { type: 'richText' }>
type ParagraphValue = RichTextValue['paragraphs'][number]

export function RichTextFields({
  value,
  label,
  disabled,
  onChange,
}: {
  value: RichTextValue
  label: string
  disabled: boolean
  onChange: (value: ContentValue) => void
}) {
  const { t } = useTranslation()
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const nodes =
    1 +
    value.paragraphs.reduce(
      (total, paragraph) => total + 1 + paragraph.texts.length,
      0,
    )

  useLayoutEffect(() => {
    if (!returnFocus.current) return

    returnFocus.current = false
    addButton.current?.focus()
  }, [value.paragraphs.length])

  return (
    <div className="content-group">
      <h4>{label}</h4>
      <p className="field-help">
        {t(
          'Paragraph text only. Text is stored literally; formatting and HTML rendering are not available.',
        )}
      </p>
      {value.paragraphs.length ? (
        value.paragraphs.map((paragraph, index) => (
          <ParagraphFields
            key={paragraph.id}
            value={paragraph}
            label={label}
            index={index + 1}
            disabled={disabled}
            canAdd={nodes < 128}
            onChange={(next) => {
              if (disabled) return

              onChange({
                type: 'richText',
                paragraphs: value.paragraphs.map((entry) =>
                  entry.id === paragraph.id ? next : entry,
                ),
              })
            }}
            onRemove={() => {
              if (disabled) return

              returnFocus.current = true
              onChange({
                type: 'richText',
                paragraphs: value.paragraphs.filter(
                  (entry) => entry.id !== paragraph.id,
                ),
              })
            }}
          />
        ))
      ) : (
        <p className="field-help">{t('Empty document')}</p>
      )}
      <Button
        ref={addButton}
        type="button"
        variant="outline"
        disabled={disabled || nodes + 2 > 128}
        onClick={() => {
          if (disabled || nodes + 2 > 128) return

          onChange({
            type: 'richText',
            paragraphs: [
              ...value.paragraphs,
              {
                id: crypto.randomUUID(),
                texts: [{ id: crypto.randomUUID(), text: '' }],
              },
            ],
          })
        }}
      >
        <Plus size={16} />
        {t('Add paragraph to {field}', { field: label })}
      </Button>
    </div>
  )
}

function ParagraphFields({
  value,
  label,
  index,
  disabled,
  canAdd,
  onChange,
  onRemove,
}: {
  value: ParagraphValue
  label: string
  index: number
  disabled: boolean
  canAdd: boolean
  onChange: (value: ParagraphValue) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useLayoutEffect(() => {
    if (!returnFocus.current) return

    returnFocus.current = false
    addButton.current?.focus()
  }, [value.texts.length])

  return (
    <section className="content-field">
      <div className="struct-card-heading">
        <h4>{t('{field} · Paragraph {index}', { field: label, index })}</h4>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('Remove {field} · Paragraph {index}', {
            field: label,
            index,
          })}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      {value.texts.length ? (
        value.texts.map((text, textIndex) => {
          const textLabel = t('{field} · Paragraph {paragraph} · Text {text}', {
            field: label,
            paragraph: index,
            text: textIndex + 1,
          })

          return (
            <div className="content-list-item" key={text.id}>
              <label>
                {textLabel}
                <Textarea
                  className="disabled:opacity-100"
                  aria-label={textLabel}
                  value={text.text}
                  disabled={disabled}
                  maxLength={4096}
                  onChange={(event) => {
                    if (disabled) return

                    onChange({
                      ...value,
                      texts: value.texts.map((entry) =>
                        entry.id === text.id
                          ? { ...entry, text: event.target.value }
                          : entry,
                      ),
                    })
                  }}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t(
                  'Remove {field} · Paragraph {paragraph} · Text {text}',
                  {
                    field: label,
                    paragraph: index,
                    text: textIndex + 1,
                  },
                )}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return

                  returnFocus.current = true
                  onChange({
                    ...value,
                    texts: value.texts.filter((entry) => entry.id !== text.id),
                  })
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )
        })
      ) : (
        <p className="field-help">{t('Empty paragraph')}</p>
      )}
      <Button
        ref={addButton}
        type="button"
        variant="outline"
        disabled={disabled || !canAdd}
        onClick={() => {
          if (disabled || !canAdd) return

          onChange({
            ...value,
            texts: [...value.texts, { id: crypto.randomUUID(), text: '' }],
          })
        }}
      >
        <Plus size={16} />
        {t('Add text to {field} · Paragraph {index}', { field: label, index })}
      </Button>
    </section>
  )
}
