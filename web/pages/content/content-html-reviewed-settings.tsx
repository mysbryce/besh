import { useId, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import type { Collection, CollectionRenderer } from '../../types/api'
import { useTranslation } from '../../i18n'
import { htmlElements } from './content-html-mapping'

export function ContentHtmlReviewedSettings({
  saved,
  collection,
  disabled,
}: {
  saved: CollectionRenderer
  collection: Collection
  disabled: boolean
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const elements = Object.entries(saved.renderer.elements)

  return (
    <div className="collection-field grid gap-3">
      <div className="collection-actions">
        <Badge variant="outline" className="max-w-full whitespace-normal">
          {saved.version === 0
            ? t('Default HTML settings · not saved')
            : t('Renderer revision {version}', { version: saved.version })}
        </Badge>
      </div>
      <p className="field-help">
        {t(
          'These are the last reviewed settings. Other sessions may have changed them.',
        )}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
      >
        {t('Configured elements')}
      </Button>
      {expanded ? (
        <div id={detailsId} className="grid min-w-0 gap-3 break-words">
          <p>{collection.name}</p>
          <p>
            {collection.struct.name}{' '}
            <Badge variant="outline" className="max-w-full whitespace-normal">
              {t('Content model revision {version}', {
                version: saved.structVersion,
              })}
            </Badge>
          </p>
          {elements.length === 0 ? (
            <p className="field-help">{t('No custom element settings')}</p>
          ) : (
            <ul className="grid gap-3">
              {elements.map(([tag, element]) => (
                <li key={tag} className="grid gap-1">
                  <p>
                    {t(
                      htmlElements.find((item) => item.tag === tag)?.label ??
                        tag,
                    )}{' '}
                    <code>{tag}</code>
                  </p>
                  {element.classes !== undefined ? (
                    <p>
                      {t('CSS classes')}:{' '}
                      <code>{JSON.stringify(element.classes)}</code>
                    </p>
                  ) : null}
                  {Object.entries(element.attributes ?? {}).map(
                    ([name, value]) => (
                      <p key={name}>
                        {name === 'title'
                          ? t('Title attribute')
                          : name === 'aria-label'
                            ? t('Accessibility label')
                            : name}
                        : <code>{JSON.stringify(value)}</code>
                      </p>
                    ),
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="field-help break-all">
            SHA-256: <code>{saved.rendererSha256}</code>
          </p>
          {saved.consumerContract ? (
            <p className="field-help break-all">
              {t('Consumer contract')}: <code>{saved.consumerContract}</code>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
