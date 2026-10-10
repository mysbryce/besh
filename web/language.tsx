import { lazy, Suspense } from 'react'
import { useLanguage, useTranslation, type Language } from './i18n'

const Select = lazy(() =>
  import('./components/ui/select').then((module) => ({
    default: module.Select,
  })),
)

const options = [
  { value: 'en', label: 'English' },
  { value: 'th', label: 'ไทย' },
  { value: 'zh', label: '中文' },
  { value: 'ru', label: 'Русский' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'pt', label: 'Português' },
]

export function LanguageControl({ disabled = false }: { disabled?: boolean }) {
  const { language, t } = useTranslation()
  const choose = useLanguage((state) => state.choose)
  const loading = useLanguage((state) => state.loading)
  const error = useLanguage((state) => state.error)

  return (
    <div className="theme-control language-control">
      <label htmlFor="language">{t('Language')}</label>
      <Suspense
        fallback={
          <span className="theme-loading">
            {options.find((option) => option.value === language)?.label}
          </span>
        }
      >
        <Select
          id="language"
          label={t('Language')}
          value={language}
          disabled={disabled || loading}
          onValueChange={(value) => void choose(value as Language)}
          options={options}
        />
      </Suspense>
      {error ? <span role="alert">{t(error)}</span> : null}
    </div>
  )
}
