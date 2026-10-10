import { useCallback, useMemo } from 'react'
import { create } from 'zustand'
import { loadMessages, messagesByLanguage } from './locales'

export const languages = ['en', 'th', 'zh', 'ru', 'ja', 'ko', 'pt'] as const
export type Language = (typeof languages)[number]
let languageRequest = 0

function deviceLanguage(): Language {
  const requested = navigator.language.split('-')[0]?.toLowerCase()
  return languages.find((value) => value === requested) ?? 'en'
}

function applyLanguage(language: Language) {
  document.documentElement.lang = language
}

export const useLanguage = create<{
  language: Language
  loading: boolean
  error: string
  choose: (language: Language) => Promise<void>
  followDevice: () => Promise<void>
}>((set) => ({
  language: 'en',
  loading: false,
  error: '',
  async choose(language) {
    if (!languages.includes(language)) return
    await activateLanguage(language, true)
  },
  async followDevice() {
    try {
      localStorage.removeItem('besh-language')
    } catch {}
    await activateLanguage(deviceLanguage(), false)
  },
}))

async function activateLanguage(language: Language, persist: boolean) {
  const request = ++languageRequest
  useLanguage.setState({ loading: true, error: '' })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      loadMessages(language),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Language load timed out')),
          5000,
        )
      }),
    ])
    if (request !== languageRequest) return
    if (persist) {
      try {
        localStorage.setItem('besh-language', language)
      } catch {}
    }
    applyLanguage(language)
    useLanguage.setState({ language, loading: false })
  } catch {
    if (request !== languageRequest) return
    applyLanguage('en')
    useLanguage.setState({
      language: 'en',
      loading: false,
      error: 'Could not load this language. English is available.',
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function initializeLanguage() {
  let language = deviceLanguage()
  try {
    const saved = localStorage.getItem('besh-language')
    language = languages.find((value) => value === saved) ?? language
  } catch {}
  await activateLanguage(language, false)
}

function translate(
  language: Language,
  key: string,
  values: Record<string, string | number> = {},
) {
  const dictionary = messagesByLanguage[language] ?? messagesByLanguage.en
  const english: Record<string, string> = messagesByLanguage.en
  const message = Object.hasOwn(dictionary, key)
    ? dictionary[key]!
    : Object.hasOwn(english, key)
      ? english[key]!
      : key
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  )
}

export function translateMessage(
  key: string,
  values: Record<string, string | number> = {},
) {
  return translate(useLanguage.getState().language, key, values)
}

export function useTranslation() {
  const language = useLanguage((state) => state.language)
  const t = useCallback(
    (key: string, values: Record<string, string | number> = {}) =>
      translate(language, key, values),
    [language],
  )
  return {
    language,
    t,
  }
}

export function useDateTime() {
  const language = useLanguage((state) => state.language)
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        calendar: 'gregory',
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [language],
  )
  return useCallback(
    (value: string | number) => {
      const date = new Date(value)
      return Number.isNaN(date.getTime())
        ? date.toLocaleString(language)
        : formatter.format(date)
    },
    [formatter, language],
  )
}
