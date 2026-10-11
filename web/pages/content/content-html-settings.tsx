import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { useTranslation } from '../../i18n'
import {
  emptyElement,
  htmlElements,
  type HtmlElement,
  type HtmlSettings,
} from './content-html-mapping'

export function ContentHtmlSettings({
  settings,
  disabled,
  onChange,
}: {
  settings: HtmlSettings
  disabled: boolean
  onChange: (settings: HtmlSettings) => void
}) {
  const { t } = useTranslation()
  const panelId = useId()
  const classesId = useId()
  const titleId = useId()
  const ariaId = useId()
  const fixedId = useId()
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState<HtmlElement>('p')
  const value = settings[tag] ?? emptyElement

  function edit(change: Partial<typeof emptyElement>) {
    if (disabled) return

    onChange({ ...settings, [tag]: { ...value, ...change } })
  }

  return (
    <div className="grid gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="justify-between"
      >
        {t('Advanced element settings')}
        <ChevronDown size={16} aria-hidden="true" />
      </Button>
      {open ? (
        <div id={panelId} className="collection-field grid gap-3">
          <p className="field-help">
            {t(
              'The preview uses default styles. Custom classes need CSS in your client.',
            )}
          </p>
          <label>
            {t('Element')}
            <Select
              label={t('Element')}
              value={tag}
              options={htmlElements.map((element) => ({
                value: element.tag,
                label: `${t(element.label)} (${element.tag})`,
              }))}
              disabled={disabled}
              onValueChange={(selected) => {
                if (disabled) return
                if (htmlElements.some((element) => element.tag === selected))
                  setTag(selected as HtmlElement)
              }}
            />
          </label>
          <label htmlFor={classesId}>
            {t('CSS classes')}
            <Input
              id={classesId}
              value={value.classes}
              disabled={disabled}
              onChange={(event) => edit({ classes: event.target.value })}
              spellCheck={false}
            />
          </label>
          <p className="field-help">
            {t(
              'Use up to 8 class names. Start with a letter or underscore; use letters, numbers, underscores or hyphens. Each name uses up to 64 characters.',
            )}
          </p>
          <label htmlFor={titleId}>
            {t('Title attribute')}
            <Input
              id={titleId}
              value={value.title}
              disabled={disabled}
              onChange={(event) => edit({ title: event.target.value })}
            />
          </label>
          <label htmlFor={ariaId}>
            {t('Accessibility label')}
            <Input
              id={ariaId}
              value={value.ariaLabel}
              disabled={disabled}
              onChange={(event) => edit({ ariaLabel: event.target.value })}
            />
          </label>
          <p className="field-help">
            {t('Title and accessibility labels use up to 160 UTF-8 bytes.')}
          </p>
          {tag === 'h1' ? (
            <div className="grid gap-2">
              <label htmlFor={fixedId} className="content-checkbox">
                <Checkbox
                  id={fixedId}
                  checked={value.fixedHeading}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    edit({ fixedHeading: checked === true })
                  }
                />
                {t('Use fixed heading identifier')}
              </label>
              <p className="field-help">
                <code>x-data="h1"</code>{' '}
                {t(
                  'Besh does not run x-data or load Alpine.js. Use this fixed identifier only with a trusted consumer that you have reviewed.',
                )}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
